import BaseDocumentWithType from '../BaseDocumentWithType';

export default class DashboardUserConfig extends BaseDocumentWithType {
  docType = 'userConfig';

  enableDevMode = false;
}
