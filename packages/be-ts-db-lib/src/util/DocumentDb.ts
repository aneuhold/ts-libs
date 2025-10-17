import { ConfigService } from '@aneuhold/be-ts-lib';
import { Document } from 'bson';
import { Collection, Db, MongoClient } from 'mongodb';

/**
 * A utility class for interacting with a MongoDB database.
 */
export default class DocumentDb {
  private static DB_NAME = 'default';

  private static mongoClient: MongoClient | undefined;

  private static db: Db | undefined;

  /**
   * Gets or creates the MongoDB client instance.
   *
   * @returns A promise that resolves to the MongoDB client.
   */
  private static async getClient(): Promise<MongoClient> {
    if (!ConfigService.isInitialized) {
      // Hard-coded local for now until there are move envs.
      await ConfigService.useConfig('local');
    }
    const { config } = ConfigService;
    if (!this.mongoClient) {
      const mongoDbConnectionString = `mongodb+srv://${config.mongoRootUsername}:${config.mongoRootPassword}@${config.mongoUrl}/?retryWrites=true&w=majority`;
      this.mongoClient = new MongoClient(mongoDbConnectionString);
    }
    // Connecting every time is evidently the correct way to do it. This is
    // because it will not do anything and just return if it is already
    // connected.
    await this.mongoClient.connect();
    return this.mongoClient;
  }

  /**
   * Gets a MongoDB collection with the specified type.
   *
   * @param collectionName - The name of the collection to retrieve.
   * @returns A promise that resolves to the typed MongoDB collection.
   */
  static async getCollection<TDocType extends Document>(
    collectionName: string
  ): Promise<Collection<TDocType>> {
    const client = await this.getClient();
    if (!DocumentDb.db) {
      DocumentDb.db = client.db(DocumentDb.DB_NAME);
    }
    return DocumentDb.db.collection<TDocType>(collectionName);
  }

  /**
   * Closes the active MongoDB connection.
   *
   * @returns A promise that resolves when the connection is closed.
   */
  static async closeDbConnection(): Promise<void> {
    if (DocumentDb.mongoClient) {
      await DocumentDb.mongoClient.close();
    }
  }
}
