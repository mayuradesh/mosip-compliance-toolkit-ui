import { Injectable } from '@angular/core';
import { v4 as uuid } from 'uuid';
import { CookieService } from 'ngx-cookie-service';
import { AppConfigService } from 'src/app/app-config.service';

@Injectable()
export class LoginRedirectService {
  constructor(
    private cookie: CookieService,
    private appService: AppConfigService
  ) { }

  redirect(url: string) {
      
    console.log(url);
    const stateParam = uuid();
    this.cookie.set('state', stateParam, undefined, '/');
    //console.log('returning false login redirect' + stateParam);
    let url1 = `${this.appService.getConfig().SERVICES_BASE_URL}${this.appService.getConfig().login
      }` +
      btoa(url) +
      '?state=' +
      stateParam;
    //console.log(url1); 
    window.location.href = url1;
  }

  impersonate(partnerId: string) {
    const stateParam = uuid();
    this.cookie.set('state', stateParam, undefined, '/');
    let redirect = '';
    const baseurl = window.location.href;
    const baseurlarr = baseurl.split("?");
    if (baseurlarr && baseurlarr.length > 0) {
      redirect = btoa(baseurlarr[0]);
    } else {
      redirect = btoa(window.location.href);
    }
    let url = `${this.appService.getConfig().SERVICES_BASE_URL}impersonatePartner/${partnerId}/${redirect}`;
    window.location.href = url +
      '?state=' +
      stateParam;
  }
}
