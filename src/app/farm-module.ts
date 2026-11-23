import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DxDataGridComponent, DxiDataGridColumnComponent } from 'devextreme-angular/ui/data-grid';
import { DxTemplateDirective } from 'devextreme-angular/core';
import { errorMessage } from './api.service';
import { Farm, FarmService } from './farm.service';

interface FieldConfig { key: string; label: string; type?: 'text'|'number'|'date'|'select'|'textarea'; required?: boolean; options?: string[]; }
interface ModuleConfig { title: string; description: string; singular: string; columns: { key:string; label:string }[]; fields: FieldConfig[]; }

const CONFIG: Record<string,ModuleConfig> = {
  fields:{title:'Fields and plots',description:'Define farm land units, sizes, soil and current use.',singular:'field',columns:[{key:'name',label:'Field'},{key:'size_hectares',label:'Size (ha)'},{key:'soil_type',label:'Soil type'},{key:'status',label:'Status'}],fields:[{key:'name',label:'Field name',required:true},{key:'size_hectares',label:'Size (hectares)',type:'number',required:true},{key:'soil_type',label:'Soil type'},{key:'status',label:'Status',type:'select',options:['Available','In use','Resting'],required:true},{key:'notes',label:'Notes',type:'textarea'}]},
  inventory:{title:'Inventory and feed',description:'Track seeds, fertilizer, medicine, chemicals and feed.',singular:'inventory item',columns:[{key:'name',label:'Item'},{key:'category',label:'Category'},{key:'quantity',label:'Quantity'},{key:'unit',label:'Unit'},{key:'reorder_level',label:'Reorder at'},{key:'expires_on',label:'Expiry'}],fields:[{key:'name',label:'Item name',required:true},{key:'category',label:'Category',type:'select',options:['Seed','Fertilizer','Medicine','Chemical','Feed','Other'],required:true},{key:'unit',label:'Unit',type:'select',options:['kg','litres','tonnes','units'],required:true},{key:'quantity',label:'Opening quantity',type:'number',required:true},{key:'reorder_level',label:'Reorder level',type:'number',required:true},{key:'expires_on',label:'Expiry date',type:'date'}]},
  tasks:{title:'Farm tasks',description:'Plan work, priorities and completion.',singular:'task',columns:[{key:'title',label:'Task'},{key:'priority',label:'Priority'},{key:'due_date',label:'Due date'},{key:'status',label:'Status'}],fields:[{key:'title',label:'Task title',required:true},{key:'priority',label:'Priority',type:'select',options:['Low','Medium','High'],required:true},{key:'due_date',label:'Due date',type:'date'},{key:'status',label:'Status',type:'select',options:['Open','In progress','Completed','Cancelled'],required:true},{key:'notes',label:'Instructions',type:'textarea'}]},
  equipment:{title:'Equipment and maintenance',description:'Track farm equipment and upcoming service dates.',singular:'equipment item',columns:[{key:'name',label:'Equipment'},{key:'category',label:'Category'},{key:'status',label:'Status'},{key:'next_service_date',label:'Next service'},{key:'maintenance_cost_kes',label:'Cost (KES)'}],fields:[{key:'name',label:'Equipment name',required:true},{key:'category',label:'Category',type:'select',options:['Tractor','Pump','Sprayer','Vehicle','Tool','Other'],required:true},{key:'status',label:'Status',type:'select',options:['Operational','Maintenance','Out of service'],required:true},{key:'next_service_date',label:'Next service date',type:'date'},{key:'maintenance_cost_kes',label:'Maintenance cost (KES)',type:'number'}]},
  finance:{title:'Farm finance',description:'Record KES income and expenses.',singular:'transaction',columns:[{key:'transaction_date',label:'Date'},{key:'type',label:'Type'},{key:'category',label:'Category'},{key:'party',label:'Buyer / supplier'},{key:'amount_kes',label:'Amount (KES)'}],fields:[{key:'type',label:'Type',type:'select',options:['Income','Expense'],required:true},{key:'category',label:'Category',required:true},{key:'transaction_date',label:'Date',type:'date',required:true},{key:'amount_kes',label:'Amount (KES)',type:'number',required:true},{key:'party',label:'Buyer or supplier'},{key:'notes',label:'Notes',type:'textarea'}]},
};

@Component({selector:'app-farm-module',imports:[FormsModule,DxTemplateDirective,DxDataGridComponent,DxiDataGridColumnComponent],templateUrl:'./farm-module.html',styleUrls:['./farm-module.css','./farm-fluid.css']})
export class FarmModule implements OnInit {
  private readonly service=inject(FarmService); private readonly route=inject(ActivatedRoute);
  readonly module=signal('fields'); readonly farms=signal<Farm[]>([]); readonly farm=signal<Farm|null>(null);
  readonly records=signal<Record<string,unknown>[]>([]); readonly open=signal(false); readonly busy=signal(false); readonly error=signal('');
  readonly editingId=signal<string|null>(null);
  draft:Record<string,any>={};
  get config():ModuleConfig{return CONFIG[this.module()];}
  async ngOnInit(){this.module.set(this.route.snapshot.data['module']);this.reset();await this.loadFarms();}
  reset(){this.draft={};for(const field of this.config.fields){if(field.options?.length)this.draft[field.key]=field.options[0];else if(field.type==='number')this.draft[field.key]=0;else this.draft[field.key]='';}}
  async loadFarms(){this.busy.set(true);try{const farms=await this.service.farms();this.farms.set(farms);const id=this.service.selectedFarmId();const selected=farms.find(f=>f.id===id)??farms[0]??null;if(selected)await this.selectFarm(selected.id);}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
  async selectFarm(id:string){const farm=this.farms().find(f=>f.id===id)??null;this.farm.set(farm);if(!farm)return;this.service.selectFarm(id);this.busy.set(true);try{this.records.set(await this.service.operations(id,this.module()));}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
  showForm(){this.editingId.set(null);this.reset();this.open.set(true);}
  edit(record:Record<string,unknown>){this.editingId.set(String(record['id']));this.draft={};for(const field of this.config.fields)this.draft[field.key]=record[field.key]??'';this.open.set(true);}
  async save(){const farm=this.farm();if(!farm)return;this.busy.set(true);this.error.set('');try{const id=this.editingId();if(id)await this.service.updateOperation(farm.id,this.module(),id,this.draft);else await this.service.createOperation(farm.id,this.module(),this.draft);this.open.set(false);this.editingId.set(null);await this.selectFarm(farm.id);}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
}
