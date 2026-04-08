
const { openingTheProject } = require('./ProjectObjects/openProject');
const { Searching } = require('./Searching/SearchingObject');
const { TableView } = require('./Table_View_Objects/TableViewObjects');
const { IViewWidget } = require('./Widgets/iViewObject');
const { HelperBase } = require('./helperBase');
const { DivisionPage } = require('./DivisionPage');
const { DepartmentPage } = require('./DepartmentPage');
const { LocationPage } = require('./LocationPage');
const { UserManagementPage } = require('./UserManagementPage');
const { AttachmentPage } = require('./AttachmentPage');
const { ProcessPage } = require('./ProcessPage');
const { AdminReviewPage } = require('./AdminReviewPage');
const { GatekeeperWorkspacePage } = require('./GatekeeperWorkspacePage');
const { ReferenceFilesPage } = require('./ReferenceFilesPage');
const { UserWorkspacePage } = require('./UserWorkspacePage');

class POManger {
  constructor(page) {
    this.page = page;
    this.loginPageObject = new loginPage(page);
    this.openProjectObject = new openingTheProject(page);
    this.searchMethodsObject = new Searching(page);
    this.tableViewObject = new TableView(page);
    this.iViewObject = new IViewWidget(page);
    this.helperBaseObject = new HelperBase(page);
    this.divisionPageObject = new DivisionPage(page);
    this.departmentPageObject = new DepartmentPage(page);
    this.locationPageObject = new LocationPage(page);
    this.userManagementPageObject = new UserManagementPage(page);
    this.attachmentPageObject = new AttachmentPage(page);
    this.processPageObject = new ProcessPage(page);
    this.adminReviewPmPageObject = new AdminReviewPage(page, 'pm');
    this.adminReviewRmfPageObject = new AdminReviewPage(page, 'rmf');
    this.gatekeeperWorkspacePageObject = new GatekeeperWorkspacePage(page);
    this.referenceFilesPageObject = new ReferenceFilesPage(page);
    this.userWorkspacePageObject = new UserWorkspacePage(page);
  }

  getLoginPage() {
    return this.loginPageObject;
  }

  getOpenProject() {
    return this.openProjectObject;
  }

  getSearchMethods() {
    return this.searchMethodsObject;
  }

  getTableViewObjects() {
    return this.tableViewObject;
  }

  getIViewObject() {
    return this.iViewObject;
  }

  getHelperBase() {
    return this.helperBaseObject;
  }

  getDivisionPage() {
    return this.divisionPageObject;
  }

  getDepartmentPage() {
    return this.departmentPageObject;
  }

  getLocationPage() {
    return this.locationPageObject;
  }

  getUserManagementPage() {
    return this.userManagementPageObject;
  }

  getAttachmentPage() {
    return this.attachmentPageObject;
  }

  getProcessPage() {
    return this.processPageObject;
  }

  getAdminReviewPage(type = 'pm') {
    return type === 'rmf' ? this.adminReviewRmfPageObject : this.adminReviewPmPageObject;
  }

  getGatekeeperWorkspacePage() {
    return this.gatekeeperWorkspacePageObject;
  }

  getReferenceFilesPage() {
    return this.referenceFilesPageObject;
  }

  getUserWorkspacePage() {
    return this.userWorkspacePageObject;
  }
}

module.exports = { POManger };
