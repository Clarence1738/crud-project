import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DxTemplateDirective } from 'devextreme-angular/core';
import { DxButtonComponent } from 'devextreme-angular/ui/button';
import { DxPopupComponent } from 'devextreme-angular/ui/popup';
import { DxSelectBoxComponent } from 'devextreme-angular/ui/select-box';
import { DxTextBoxComponent } from 'devextreme-angular/ui/text-box';
import { Status, TransportDraft } from './transport.service';

@Component({
  selector: 'app-shipment-editor',
  imports: [
    FormsModule,
    DxTemplateDirective,
    DxButtonComponent,
    DxPopupComponent,
    DxSelectBoxComponent,
    DxTextBoxComponent,
  ],
  templateUrl: './shipment-editor.html',
  styleUrl: './app.css',
})
export class ShipmentEditor {
  readonly draft = input.required<TransportDraft>();
  readonly editing = input.required<boolean>();
  readonly busy = input.required<boolean>();
  readonly message = input.required<string>();
  readonly statuses = input.required<Status[]>();
  readonly saveShipment = output<void>();
  readonly dismiss = output<void>();
}
