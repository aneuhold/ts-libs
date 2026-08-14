import { DR } from '@aneuhold/core-ts-lib';
import path from 'path';
import type { PackageNode, PackageToPublish } from '../types/LocalPackageOperations.js';
import type { LocalPackageStore, PublishedPackage } from '../types/LocalPackageStore.js';
import { PackageJsonService } from './PackageJson.service.js';

/**
 * Service for the graph the locally published packages form by depending on
 * each other, which is what says who else has to be published when one of them
 * is.
 *
 * The graph is derived per publish and never stored, so an edge is the presence
 * of a dependency key rather than the specifier it holds, and a specifier this
 * tool rewrote cannot change what it sees.
 */
export class LocalPackageGraphService {
  /**
   * The packages one publish covers, in the order they have to be published in.
   *
   * The directory the publish ran in comes first, followed by the packages that
   * depend on it, each one after every package it depends on. Packages that
   * reach no subscriber are left out, since nothing installs them.
   *
   * @param store - The store the published packages are read from
   * @param rootPackage - The package the publish runs for, which is published whether or not the store already holds it
   */
  static async getPublishOrderStartingFrom(
    store: LocalPackageStore,
    rootPackage: PublishedPackage
  ): Promise<PackageToPublish[]> {
    const nodes = await this.#buildNodes(store, rootPackage);
    const rootKey = this.#getNodeKey(rootPackage);

    const dependentClosure = this.#collectDependentClosure(nodes, rootKey);
    const publishOrder = this.#sortTopologically(nodes, dependentClosure, rootKey);
    const keysReachingASubscriber = this.#collectKeysReachingASubscriber(nodes);

    return publishOrder
      .filter((nodeKey) => nodeKey === rootKey || keysReachingASubscriber.has(nodeKey))
      .flatMap((nodeKey) => {
        const node = nodes.get(nodeKey);
        if (!node) {
          return [];
        }
        return [
          {
            ...node.publishedPackage,
            dependencies: [...node.dependencyKeys].flatMap((dependencyKey) => {
              const dependency = nodes.get(dependencyKey);
              return dependency ? [dependency.publishedPackage] : [];
            })
          }
        ];
      });
  }

  /**
   * Builds every node of the graph and the edges between them.
   *
   * @param store - The store the published packages are read from
   * @param rootPackage - The package the publish runs for
   */
  static async #buildNodes(
    store: LocalPackageStore,
    rootPackage: PublishedPackage
  ): Promise<Map<string, PackageNode>> {
    const nodes = new Map<string, PackageNode>();
    const pathsByPackageName = new Map<string, string[]>();

    const addNode = (publishedPackage: PublishedPackage, hasSubscribers: boolean): void => {
      const nodeKey = this.#getNodeKey(publishedPackage);
      if (nodes.has(nodeKey)) {
        return;
      }
      nodes.set(nodeKey, {
        publishedPackage,
        dependencyKeys: new Set(),
        dependentKeys: new Set(),
        hasSubscribers
      });
      pathsByPackageName.set(publishedPackage.packageName, [
        ...(pathsByPackageName.get(publishedPackage.packageName) ?? []),
        publishedPackage.packagePath
      ]);
    };

    for (const [packageName, pathEntries] of Object.entries(store.packages)) {
      for (const [packagePath, entry] of Object.entries(pathEntries ?? {})) {
        if (entry) {
          addNode({ packageName, packagePath }, entry.subscribers.length > 0);
        }
      }
    }
    // A first publish is not in the store yet, and it still cascades
    addNode(rootPackage, false);

    await Promise.all(
      [...nodes.values()].map((node) => this.#addDependencyEdges(nodes, pathsByPackageName, node))
    );

    return nodes;
  }

  /**
   * Reads what one node declares as dependencies and records an edge for every
   * one of them that another node publishes.
   *
   * @param nodes - Every node of the graph
   * @param pathsByPackageName - The directories each package name is published from
   * @param node - The node whose dependencies are read
   */
  static async #addDependencyEdges(
    nodes: Map<string, PackageNode>,
    pathsByPackageName: Map<string, string[]>,
    node: PackageNode
  ): Promise<void> {
    const { packageName, packagePath } = node.publishedPackage;
    const packageInfo = await PackageJsonService.getPackageInfo(packagePath, false);

    if (!packageInfo) {
      DR.logger.warn(
        `The package.json of ${packageName} in ${packagePath} could not be read, so nothing it depends on is published with it. Run 'local-npm prune' if the directory is gone.`
      );
      return;
    }

    // Only `dependencies` count, since neither a devDependency nor a
    // peerDependency is carried in a dependent's tarball
    for (const dependencyName of Object.keys(packageInfo.dependencies ?? {})) {
      const candidatePaths = pathsByPackageName.get(dependencyName);
      if (!candidatePaths) {
        continue;
      }

      const dependencyPath = this.#resolveDependencyPath(
        packagePath,
        dependencyName,
        candidatePaths
      );
      if (!dependencyPath) {
        continue;
      }

      const dependencyKey = this.#getNodeKey({
        packageName: dependencyName,
        packagePath: dependencyPath
      });
      node.dependencyKeys.add(dependencyKey);
      nodes.get(dependencyKey)?.dependentKeys.add(this.#getNodeKey(node.publishedPackage));
    }
  }

  /**
   * Resolves which of the directories publishing a dependency the one that
   * depends on it means, which is the directory sharing the longest segment
   * wise common ancestor with it.
   *
   * A tie is dropped rather than guessed at, since publishing the wrong
   * directory's build is worse than publishing neither.
   *
   * @param dependentPath - The directory that declares the dependency
   * @param dependencyName - Name of the declared dependency
   * @param candidatePaths - The directories that publish it
   */
  static #resolveDependencyPath(
    dependentPath: string,
    dependencyName: string,
    candidatePaths: string[]
  ): string | null {
    if (candidatePaths.length === 1) {
      return candidatePaths[0];
    }

    const dependentSegments = dependentPath.split(path.sep);
    // Ranked by how much of its path each candidate shares with the directory
    // that depends on it
    const rankedCandidates = candidatePaths
      .map((candidatePath) => ({
        candidatePath,
        sharedSegments: this.#countSharedLeadingSegments(
          dependentSegments,
          candidatePath.split(path.sep)
        )
      }))
      .sort((first, second) => second.sharedSegments - first.sharedSegments);

    const tiedCandidates = rankedCandidates.filter(
      ({ sharedSegments }) => sharedSegments === rankedCandidates[0].sharedSegments
    );

    if (tiedCandidates.length > 1) {
      const candidates = tiedCandidates.map(({ candidatePath }) => `  ${candidatePath}`).join('\n');
      DR.logger.warn(
        `${dependencyName} is published from ${tiedCandidates.length} directories that sit equally close to ${dependentPath}, so it is not published with it:\n${candidates}`
      );
      return null;
    }

    return rankedCandidates[0].candidatePath;
  }

  /**
   * How many leading segments two paths hold in common.
   *
   * @param firstSegments - Segments of the first path
   * @param secondSegments - Segments of the second path
   */
  static #countSharedLeadingSegments(firstSegments: string[], secondSegments: string[]): number {
    let sharedSegments = 0;
    while (
      sharedSegments < firstSegments.length &&
      sharedSegments < secondSegments.length &&
      firstSegments[sharedSegments] === secondSegments[sharedSegments]
    ) {
      sharedSegments += 1;
    }
    return sharedSegments;
  }

  /**
   * Every node reachable from one node by following dependent edges, which is
   * the node itself along with everything that depends on it.
   *
   * @param nodes - Every node of the graph
   * @param rootKey - Key of the node to walk from
   */
  static #collectDependentClosure(nodes: Map<string, PackageNode>, rootKey: string): Set<string> {
    const reachedKeys = new Set([rootKey]);
    const pendingKeys = [rootKey];

    for (let index = 0; index < pendingKeys.length; index += 1) {
      for (const dependentKey of nodes.get(pendingKeys[index])?.dependentKeys ?? []) {
        if (!reachedKeys.has(dependentKey)) {
          reachedKeys.add(dependentKey);
          pendingKeys.push(dependentKey);
        }
      }
    }

    return reachedKeys;
  }

  /**
   * Orders a set of nodes so that each one comes after every node it depends
   * on, starting from the node the publish runs for.
   *
   * @param nodes - Every node of the graph
   * @param keysToSort - Keys of the nodes to order, which the edges are restricted to
   * @param rootKey - Key of the node the order starts at
   */
  static #sortTopologically(
    nodes: Map<string, PackageNode>,
    keysToSort: Set<string>,
    rootKey: string
  ): string[] {
    const sortedKeys: string[] = [];
    const settledKeys = new Set<string>();
    const keysOnCurrentPath: string[] = [];

    const visit = (nodeKey: string): void => {
      if (settledKeys.has(nodeKey)) {
        return;
      }

      const cycleStart = keysOnCurrentPath.indexOf(nodeKey);
      if (cycleStart !== -1) {
        const cycle = [...keysOnCurrentPath.slice(cycleStart), nodeKey]
          .map((keyInCycle) => nodes.get(keyInCycle)?.publishedPackage.packageName ?? keyInCycle)
          .join(' -> ');
        throw new Error(
          `The locally published packages depend on each other in a cycle, which has no order they can be published in: ${cycle}`
        );
      }

      keysOnCurrentPath.push(nodeKey);
      for (const dependencyKey of nodes.get(nodeKey)?.dependencyKeys ?? []) {
        if (keysToSort.has(dependencyKey)) {
          visit(dependencyKey);
        }
      }
      keysOnCurrentPath.pop();

      settledKeys.add(nodeKey);
      sortedKeys.push(nodeKey);
    };

    // Everything else in the set depends on the root, so it settles first and
    // nothing displaces it
    visit(rootKey);
    for (const nodeKey of keysToSort) {
      visit(nodeKey);
    }

    return sortedKeys;
  }

  /**
   * The keys of every node that reaches a subscriber by following dependent
   * edges, which is every node whose build somebody installs.
   *
   * @param nodes - Every node of the graph
   */
  static #collectKeysReachingASubscriber(nodes: Map<string, PackageNode>): Set<string> {
    const reachingKeys = new Set<string>();
    const pendingKeys: string[] = [];

    for (const [nodeKey, node] of nodes) {
      if (node.hasSubscribers) {
        reachingKeys.add(nodeKey);
        pendingKeys.push(nodeKey);
      }
    }

    // A node a reaching node depends on reaches the same subscriber, since the
    // dependent edge back to it is the one the walk would take
    for (let index = 0; index < pendingKeys.length; index += 1) {
      for (const dependencyKey of nodes.get(pendingKeys[index])?.dependencyKeys ?? []) {
        if (!reachingKeys.has(dependencyKey)) {
          reachingKeys.add(dependencyKey);
          pendingKeys.push(dependencyKey);
        }
      }
    }

    return reachingKeys;
  }

  /**
   * The key one {@link PublishedPackage} is held under, which names the
   * directory as well as the package because one package name can be published
   * from several directories.
   *
   * @param publishedPackage - The package to key
   */
  static #getNodeKey(publishedPackage: PublishedPackage): string {
    return `${publishedPackage.packageName}@${publishedPackage.packagePath}`;
  }
}
