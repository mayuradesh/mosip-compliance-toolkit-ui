import { Component, OnInit, ViewChild } from '@angular/core';
import { BreadcrumbService } from 'xng-breadcrumb';
import { Router, ActivatedRoute } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortable } from '@angular/material/sort';
import { FormGroup, FormControl } from '@angular/forms';
import { AuthService } from '../../../core/services/authservice.service';
import { DataService } from '../../../core/services/data-service';
import { Subscription } from 'rxjs';
import * as appConstants from 'src/app/app.constants';
import { MatDialog } from '@angular/material/dialog';
import { ScanDeviceComponent } from '../../test-run/scan-device/scan-device.component';
import { ExecuteTestRunComponent } from '../../test-run/execute-test-run/execute-test-run.component';
import Utils from 'src/app/app.utils';
import { SdkProjectModel } from 'src/app/core/models/sdk-project';
import { environment } from 'src/environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { UserProfileService } from 'src/app/core/services/user-profile.service';
import { AbisProjectModel } from 'src/app/core/models/abis-project';
import { DialogComponent } from 'src/app/core/components/dialog/dialog.component';

export interface CollectionsData {
  collectionId: string;
  name: string;
  testCaseCount: number;
  crDtimes: Date;
  runDtimes: Date;
  runId: string;
  isValidateEnabled: false
}
@Component({
  selector: 'app-view-project',
  templateUrl: './view-project.component.html',
  styleUrls: ['./view-project.component.css'],
})
export class ViewProjectComponent implements OnInit {
  projectId: string;
  projectType: string;
  projectForm = new FormGroup({});
  projectFormData: any;
  allControls: string[];
  dataSource: MatTableDataSource<CollectionsData>;
  displayedColumns: string[] = [
    'name',
    'testCaseCount',
    'crDtimes',
    'runDtimes',
    'actions',
    'actionsMore'
  ];
  isAndroidAppMode = environment.isAndroidAppMode == 'yes' ? true : false;
  textDirection: any = this.userProfileService.getTextDirection();
  buttonPosition: any = this.textDirection == 'rtl' ? {'float': 'left'} : {'float': 'right'};
  isMobileButton: any = this.textDirection == 'rtl' ? true : false;
  isScanComplete =
    localStorage.getItem(appConstants.SBI_SCAN_COMPLETE) == 'true'
      ? true
      : false;
  hidePassword = true;
  subscriptions: Subscription[] = [];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataLoaded = false;
  updatingAttribute: string;
  panelOpenState = false;
  bioTestDataFileNames: string[] = [];
  resourceBundleJson: any = {};
  deviceImageUrls: string[] = [];
  impersonateReadOnlyMode = localStorage.getItem(appConstants.IMPERSONATE_MODE) == appConstants.IMPERSONATE_MODE_READ_ONLY
            ? true
            : false;
  constructor(
    public authService: AuthService,
    private dataService: DataService,
    private router: Router,
    private dialog: MatDialog,
    private breadcrumbService: BreadcrumbService,
    private activatedRoute: ActivatedRoute,
    private userProfileService: UserProfileService,
    private translate:TranslateService
  ) { }

  async ngOnInit() {
    this.translate.use(this.userProfileService.getUserPreferredLanguage());
    this.resourceBundleJson = await Utils.getResourceBundle(this.userProfileService.getUserPreferredLanguage(), this.dataService);
    await this.initProjectIdAndType();
    if (this.projectType == appConstants.SBI) {
      this.initSbiProjectForm();
      this.projectFormData = await Utils.getSbiProjectDetails(this.projectId, this.dataService, this.resourceBundleJson, this.dialog);
      Utils.populateSbiProjectForm(this.projectFormData, this.projectForm);
      this.getDeviceImageUrl();
    }
    if (this.projectType == appConstants.SDK) {
      this.initSdkProjectForm();
      this.projectFormData = await Utils.getSdkProjectDetails(this.projectId, this.dataService, this.resourceBundleJson, this.dialog);
      Utils.populateSdkProjectForm(this.projectFormData, this.projectForm);
      this.bioTestDataFileNames = await Utils.getBioTestDataNames(this.subscriptions, this.dataService, this.projectForm.controls['sdkPurpose'].value, this.resourceBundleJson, this.dialog);
    }
    if (this.projectType == appConstants.ABIS) {
      this.initAbisProjectForm();
      this.projectFormData = await Utils.getAbisProjectDetails(this.projectId, this.dataService, this.resourceBundleJson, this.dialog);
      Utils.populateAbisProjectForm(this.projectFormData, this.projectForm);
      this.bioTestDataFileNames = await Utils.getBioTestDataNames(this.subscriptions, this.dataService, appConstants.ABIS, this.resourceBundleJson, this.dialog);
    }
    await this.getCollections();
    this.dataSource.paginator = this.paginator;
    this.sort.sort(({ id: 'runDtimes', start: 'desc' }) as MatSortable);
    this.dataSource.sort = this.sort;
    this.initBreadCrumb();
    this.dataLoaded = true;
  }

  initProjectIdAndType() {
    return new Promise((resolve) => {
      this.activatedRoute.params.subscribe((param) => {
        this.projectId = param['projectId'];
        this.projectType = param['projectType'];
      });
      resolve(true);
    });
  }

  initBreadCrumb() {
    if (this.projectFormData) {
      const breadcrumbLabels = this.resourceBundleJson['breadcrumb'];
      if (breadcrumbLabels) {
        this.breadcrumbService.set('@homeBreadCrumb', `${breadcrumbLabels.home}`);
        this.breadcrumbService.set(
          '@projectBreadCrumb',
          `${this.projectType} ${breadcrumbLabels.project} - ${this.projectFormData.name}`
        );
      }
    }
  }

  initSbiProjectForm() {
    this.allControls = [
      ...appConstants.COMMON_CONTROLS,
      ...appConstants.SBI_CONTROLS,
    ];
    this.allControls.forEach((controlId) => {
      this.projectForm.addControl(
        controlId,
        new FormControl({ value: '', disabled: true })
      );
    });
  }

  initSdkProjectForm() {
    this.allControls = [
      ...appConstants.COMMON_CONTROLS,
      ...appConstants.SDK_CONTROLS,
    ];
    this.allControls.forEach((controlId) => {
      this.projectForm.addControl(
        controlId,
        new FormControl({
          value: '',
          disabled:
            controlId == 'sdkUrl' || controlId == 'bioTestData' ? false : true,
        })
      );
    });
  }

  initAbisProjectForm() {
    this.allControls = [
      ...appConstants.COMMON_CONTROLS,
      ...appConstants.ABIS_CONTROLS,
    ];
    this.allControls.forEach((controlId) => {
      this.projectForm.addControl(
        controlId,
        new FormControl({
          value: '',
          disabled:
            controlId == 'abisUrl' || controlId == 'username' || controlId == 'password' || controlId == 'outboundQueueName'
            || controlId == 'inboundQueueName' || controlId == 'abisBioTestData' ? false : true,
        })
      );
    });
  }

  async getCollections() {
    return new Promise((resolve, reject) => {
      this.subscriptions.push(
        this.dataService
          .getCollections(this.projectId, this.projectType)
          .subscribe(
            (response: any) => {
              this.dataSource = new MatTableDataSource(
                response[appConstants.RESPONSE]['collections']
              );
              resolve(true);
            },
            (errors) => {
              Utils.showErrorMessage(this.resourceBundleJson, errors, this.dialog);
              resolve(false);
            }
          )
      );
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  async showDashboard() {
    if (this.authService.isAuthenticated()) {
      await this.router.navigate([`toolkit/dashboard`]);
    } else {
      await this.router.navigate([``]);
    }
  }

  async handleSdkPurposeChange() {
    this.bioTestDataFileNames = await Utils.getBioTestDataNames(this.subscriptions, this.dataService, this.projectForm.controls['sdkPurpose'].value, this.resourceBundleJson, this.dialog);
  }

  async addCollection() {
    await this.router.navigate([
      `toolkit/project/${this.projectType}/${this.projectId}/collection/add`,
    ]);
  }

  async viewCollection(collection: any) {
    await this.router.navigate([
      `toolkit/project/${this.projectType}/${this.projectId}/collection/${collection.collectionId}`,
    ]);
  }

  scanDevice() {
    const body = {
      title: 'Scan Device',
      sbiDeviceType: this.projectFormData && this.projectFormData.deviceType ? this.projectFormData.deviceType : ""
    };
    this.dialog
      .open(ScanDeviceComponent, {
        width: '600px',
        data: body,
      })
      .afterClosed()
      .subscribe(
        () =>
        (this.isScanComplete =
          localStorage.getItem(appConstants.SBI_SCAN_COMPLETE) == 'true'
            ? true
            : false)
      );
  }
  async runCollection(row: any) {
    const body = {
      collectionId: row.collectionId,
      projectType: this.projectType,
      projectId: this.projectId,
      sbiDeviceType: this.projectFormData && this.projectFormData.deviceType ? this.projectFormData.deviceType : ""
    };
    this.dialog
      .open(ExecuteTestRunComponent, {
        width: '800px',
        data: body,
      })
      .afterClosed()
      .subscribe((result: any) => {
        if (result == 'reloadProjectDetails') {
          window.location.reload();
        }
      });
  }

  fetchResultsFromAbisQueue() {

  }

  async viewTestRun(row: any) {
    await this.router.navigate([
      `toolkit/project/${this.projectType}/${this.projectId}/collection/${row.collectionId}/testrun/${row.runId}`,
    ]);
  }

  async viewTestRunsHistory(row: any) {
    await this.router.navigate([
      `toolkit/project/${this.projectType}/${this.projectId}/collection/${row.collectionId}/testrunhistory`,
    ]);
  }

  async updateProject(attributeName: string) {
    this.projectForm.controls['projectType'].markAsTouched();
    const projectType = this.projectForm.controls['projectType'].value;
    console.log(`updateProject for type: ${projectType}`);
    if (projectType == appConstants.SDK) {
      appConstants.SDK_CONTROLS.forEach((controlId) => {
        this.projectForm.controls[controlId].markAsTouched();
      });
    }
    if (projectType == appConstants.ABIS) {
      appConstants.ABIS_CONTROLS.forEach((controlId) => {
        this.projectForm.controls[controlId].markAsTouched();
      });
    }
    if (this.projectForm.valid) {
      //Save the project in db
      console.log('valid');
      if (projectType == appConstants.SDK) {
        let request = {
          id: appConstants.SDK_PROJECT_UPDATE_ID,
          version: appConstants.VERSION,
          requesttime: new Date().toISOString(),
          request: Utils.populateSdkProjectData(this.projectForm, this.projectFormData.id),
        };
        this.updatingAttribute = attributeName;
        await Utils.updateSdkProject(this.subscriptions, this.dataService, request, this.resourceBundleJson, this.dialog);
        Utils.populateSdkProjectForm(this.projectFormData, this.projectForm);
        this.panelOpenState = true;
      }
      if (projectType == appConstants.ABIS) {
        let request = {
          id: appConstants.ABIS_PROJECT_UPDATE_ID,
          version: appConstants.VERSION,
          requesttime: new Date().toISOString(),
          request: Utils.populateAbisProjectData(this.projectForm, this.projectFormData.id),
        };
        this.updatingAttribute = attributeName;
        await Utils.updateAbisProject(this.subscriptions, this.dataService, request, this.resourceBundleJson, this.dialog);
        Utils.populateAbisProjectForm(this.projectFormData, this.projectForm);
        this.panelOpenState = true;
      }
      this.updatingAttribute = '';
    }
  }

  downloadEncryptionKey() {
    const subs = this.dataService.getEncryptionKey().subscribe(
      (res: any) => {
        if (res) {
          let obj = res[appConstants.RESPONSE];
          if (obj) {
            var blob = new Blob([obj], { type: 'application/json' });
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = `key.cer`;
            link.click();
          }
        } else {
          const err = {
            errorCode: 'ENCRYPTION_KEY_001',
            message: ''
          }
          Utils.showErrorMessage(
            this.resourceBundleJson,
            [err],
            this.dialog,
            'Unable to get encryption key. Try Again!'
          );
        }
      },
      (errors) => {
        Utils.showErrorMessage(this.resourceBundleJson, errors, this.dialog);
      }
    );
    this.subscriptions.push(subs);
  }

  getDeviceImageUrl() {
    if (this.projectFormData.deviceImage1) {
      this.deviceImageUrls.push(this.projectFormData.deviceImage1);
    }
    if (this.projectFormData.deviceImage2) {
      this.deviceImageUrls.push(this.projectFormData.deviceImage2);
    }
    if (this.projectFormData.deviceImage3) {
      this.deviceImageUrls.push(this.projectFormData.deviceImage3);
    }
    if (this.projectFormData.deviceImage4) {
      this.deviceImageUrls.push(this.projectFormData.deviceImage4);
    }
  }

  clickOnButton() {
    const dialogRef = this.dialog.open(DialogComponent, {
      width: '50%',
      data: {
        case: "DEVICE_IMAGES",
        deviceImagesUrl: this.deviceImageUrls,
      },
    });
    dialogRef.afterClosed();
  }
}
