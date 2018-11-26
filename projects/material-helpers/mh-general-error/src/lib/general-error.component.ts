import { Component, Input } from '@angular/core';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'general-error',
  templateUrl: './general-error.component.html',
  styleUrls: ['./general-error.component.scss']
})
export class GeneralErrorComponent {
  @Input() errors: any;
}
