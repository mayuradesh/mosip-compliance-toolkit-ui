import { OnInit, Component, ViewChild } from '@angular/core';
import { TranslateService } from "@ngx-translate/core";
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSort, MatSortable } from '@angular/material/sort';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from 'src/app/core/services/data-service';
import { Subscription } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import * as appConstants from 'src/app/app.constants';
import Utils from 'src/app/app.utils';
import { UserProfileService } from 'src/app/core/services/user-profile.service';
import { environment } from 'src/environments/environment';
import { BreadcrumbService } from 'xng-breadcrumb';
import { DialogComponent } from 'src/app/core/components/dialog/dialog.component';
import { AppConfigService } from 'src/app/app-config.service';
import { CookieService } from 'ngx-cookie-service';

export interface ProjectData {
  id: string;
  name: string;
  projectType: string;
  collectionsCount: number;
  crDate: Date;
  lastRunDt: Date;
  lastRunStatus: string;
  lastRunId: string;
}

@Component({
  selector: 'app-projects-dashboard',
  templateUrl: './projects-dashboard.component.html',
  styleUrls: ['./projects-dashboard.component.css'],
})
export class ProjectsDashboardComponent implements OnInit {
  dataSource: MatTableDataSource<ProjectData>;
  displayedColumns: string[] = [
    'name',
    'projectType',
    'collectionsCount',
    'crDate',
    'lastRunDt',
    'lastRunStatus',
    'actions',
  ];
  dataLoaded = false;
  projectFormData: any;
  subscriptions: Subscription[] = [];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  isAndroidAppMode = environment.isAndroidAppMode == 'yes' ? true : false;
  textDirection: any = this.userProfileService.getTextDirection();
  buttonPosition: any = this.textDirection == 'rtl' ? { 'float': 'left' } : { 'float': 'right' };
  resourceBundleJson: any = {};
  impersonateError = false;
  impersonatePartnerId = '';
  impersonateReadOnlyMode = false;
  constructor(
    private router: Router,
    private translate: TranslateService,
    private activatedRoute: ActivatedRoute,
    private breadcrumbService: BreadcrumbService,
    private dialog: MatDialog,
    private userProfileService: UserProfileService,
    private dataService: DataService,
    private paginatorIntl: MatPaginatorIntl,
    private appConfigService: AppConfigService,
    private cookieService: CookieService
  ) { }

  async ngOnInit() {
    this.translate.use(this.userProfileService.getUserPreferredLanguage());
    this.resourceBundleJson = await Utils.getResourceBundle(this.userProfileService.getUserPreferredLanguage(), this.dataService);
    this.paginatorIntl.itemsPerPageLabel = this.resourceBundleJson.paginationLabel['itemPerPage'];
    this.paginatorIntl.getRangeLabel = (page: number, pageSize: number, length: number) => {
      const from = (page) * pageSize + 1;
      const to = Math.min((page + 1) * pageSize, length);
      return `${from} - ${to} ${this.resourceBundleJson.paginationLabel['rangeLabel']} ${length}`;
    };
    await this.getProjects();
    this.initBreadCrumb();
    this.dataLoaded = true;
    this.dataSource.paginator = this.paginator;
    this.sort.sort(({ id: 'lastRunDt', start: 'desc' }) as MatSortable);
    this.dataSource.sort = this.sort;
    //set the read only mode when impersonation is being done
    this.impersonateReadOnlyMode = localStorage.getItem(appConstants.IMPERSONATE_MODE) == appConstants.IMPERSONATE_MODE_READ_ONLY
      ? true
      : false
    await this.setImpersonateMode();
    //show the option to impersonate another user, impersonatePartnerRole is available   
    let roles: string[] = this.userProfileService.getRoles().split(",");
    const impersonatePartnerRole = this.appConfigService.getConfig()['impersonatePartnerRole'];
    if (roles && (roles.includes(impersonatePartnerRole))) {
      await this.initImpersonatePartnerParams();
      if (!this.impersonateReadOnlyMode) {
        this.showSelectPartnerView();
      }
    }
    this.dataLoaded = true;
  }

  initImpersonatePartnerParams() {
    return new Promise((resolve) => {
      this.activatedRoute.queryParams.subscribe((param) => {
        let impersonateError = param['impersonateError'];
        if (impersonateError == "exists") {
          this.impersonateError = true;
        }
        let impersonatePartnerId = param['impersonatePartnerId'];
        if (impersonatePartnerId && impersonatePartnerId != "") {
          this.impersonatePartnerId = impersonatePartnerId;
        }
      });
      resolve(true);
    });
  }

  initBreadCrumb() {
    const breadcrumbLabels = this.resourceBundleJson['breadcrumb'];
    if (breadcrumbLabels) {
      this.breadcrumbService.set('@homeBreadCrumb', `${breadcrumbLabels.home}`);
      this.breadcrumbService.set('@projectDashboardBreadCrumb', `${breadcrumbLabels.projectsDashboard}`);
    }
  }
  async setImpersonateMode() {
    return new Promise((resolve) => {
      this.activatedRoute.queryParams.subscribe((param) => {
        let impersonateMode = param[appConstants.IMPERSONATE_MODE];
        if (impersonateMode == appConstants.IMPERSONATE_MODE_READ_ONLY) {
          localStorage.setItem(appConstants.IMPERSONATE_MODE, appConstants.IMPERSONATE_MODE_READ_ONLY);
          this.impersonateReadOnlyMode = true;
        }
      });
      resolve(true);
    });
  }
  async getProjects(): Promise<boolean> {
    let projectType = "";
    if (this.isAndroidAppMode) {
      projectType = appConstants.SBI;
    }
    return new Promise((resolve, reject) => {
      this.subscriptions.push(
        this.dataService.getProjects(projectType).subscribe(
          (response: any) => {
            (async () => {
              console.log(response);
              let dataArr = response['response']['projects'];
              let tableData = [];
              for (let row of dataArr) {
                if (row.lastRunId) {
                  let runStatus = await this.getTestRunStatus(row.lastRunId);
                  tableData.push({
                    ...row,
                    lastRunStatus: runStatus,
                  });
                } else {
                  tableData.push({
                    ...row,
                    lastRunStatus: '',
                  });
                }
              }
              this.dataSource = new MatTableDataSource(tableData);
              resolve(true);
            })().catch((error) => reject(error));
          },
          (errors) => {
            Utils.showErrorMessage(this.resourceBundleJson, errors, this.dialog);
            resolve(false);
          }
        )
      );
    });
  }

  async getTestRunStatus(runId: string) {
    return new Promise((resolve, reject) => {
      this.subscriptions.push(
        this.dataService.getTestRunStatus(runId).subscribe(
          (response: any) => {
            resolve(response['response']['resultStatus']);
          },
          (errors) => {
            Utils.showErrorMessage(this.resourceBundleJson, errors, this.dialog);
            resolve(false);
          }
        )
      );
    });
  }

  async addProject() {
    await this.router.navigate([`toolkit/project/add`]);
  }

  async viewProject(project: any) {
    if (this.isAndroidAppMode) {
      localStorage.removeItem(appConstants.SBI_SELECTED_PORT);
      localStorage.removeItem(appConstants.SBI_SELECTED_DEVICE);
      localStorage.removeItem(appConstants.SBI_SCAN_DATA);
      localStorage.removeItem(appConstants.SBI_SCAN_COMPLETE);
    }
    if (project.projectType == appConstants.SBI) {
      this.projectFormData = await Utils.getSbiProjectDetails(project.id, this.dataService, this.resourceBundleJson, this.dialog);
      const sbiHash = this.projectFormData.sbiHash;
      const websiteUrl = this.projectFormData.websiteUrl;
      if (sbiHash == 'To_Be_Added' || websiteUrl == 'To_Be_Added') {
        await this.showUpdateProject(project.id, project.projectType);
      } else {
        await this.router.navigate([
          `toolkit/project/${project.projectType}/${project.id}`,
        ]);
      }
    }
    if (project.projectType == appConstants.SDK) {
      this.projectFormData = await Utils.getSdkProjectDetails(project.id, this.dataService, this.resourceBundleJson, this.dialog);
      const sdkHash = this.projectFormData.sdkHash;
      const websiteUrl = this.projectFormData.websiteUrl;
      if (sdkHash == 'To_Be_Added' || websiteUrl == 'To_Be_Added') {
        await this.showUpdateProject(project.id, project.projectType);
      } else {
        await this.router.navigate([
          `toolkit/project/${project.projectType}/${project.id}`,
        ]);
      }
    }
    if (project.projectType == appConstants.ABIS) {
      this.projectFormData = await Utils.getAbisProjectDetails(project.id, this.dataService, this.resourceBundleJson, this.dialog);
      const abisHash = this.projectFormData.abisHash;
      const websiteUrl = this.projectFormData.websiteUrl;
      if (abisHash == 'To_Be_Added' || websiteUrl == 'To_Be_Added') {
        await this.showUpdateProject(project.id, project.projectType);
      } else {
        await this.router.navigate([
          `toolkit/project/${project.projectType}/${project.id}`,
        ]);
      }
    }
  }

  async showSelectPartnerView() {
    console.log(`impersonateError ${this.impersonateError}`);
    console.log(`impersonatePartnerId ${this.impersonatePartnerId}`);

    const body = {
      case: 'SELECT_PARTNER',
      impersonateError: this.impersonateError,
      impersonatePartnerId: this.impersonatePartnerId
    };
    const dialogRef = this.dialog.open(DialogComponent, {
      width: '600px',
      data: body,
    });
    dialogRef.disableClose = true;
  }

  async showUpdateProject(projectId: any, projectType: any) {
    const body = {
      case: 'UPDATE_PROJECT',
      id: projectId,
      projectType: projectType
    };
    const dialogRef = this.dialog.open(DialogComponent, {
      width: '600px',
      data: body,
    });
    dialogRef.disableClose = false;
  }

  async showBiometricDashboard() {
    await this.router.navigate([`toolkit/dashboard/biometric`]);
  }

  deleteProject(project: any) {
    alert('not available');
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    this.dataSource.filterPredicate = this.customFilterPredicate;
  }

  customFilterPredicate(data: ProjectData, filter: string): boolean {
    const formattedDate = new Date(filter);
    const crDate = new Date(data.crDate);

    const nameMatch = data.name.trim().toLowerCase().includes(filter);
    const typeMatch = data.projectType.trim().toLowerCase().includes(filter);
    const dateMatch = crDate.toDateString() === formattedDate.toDateString();

    return nameMatch || typeMatch || dateMatch;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }
}
