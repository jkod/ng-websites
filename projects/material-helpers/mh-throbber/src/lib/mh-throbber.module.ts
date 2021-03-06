import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ThrobberComponent } from './throbber.component';

@NgModule({
  declarations: [
    ThrobberComponent
  ],
  imports: [
    CommonModule,
    MatProgressSpinnerModule
  ],
  exports: [
    ThrobberComponent
  ]
})
export class MhThrobberModule { }
