import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DxDataGridComponent, DxiDataGridColumnComponent } from 'devextreme-angular/ui/data-grid';
import { DxTemplateDirective } from 'devextreme-angular/core';
import { errorMessage } from './api.service';
import { AuthService } from './auth.service';
import { Farm, farmCan, FarmService } from './farm.service';

type Lookup = 'crops' | 'livestock' | 'members';
interface FieldConfig { key: string; label: string; type?: 'text'|'number'|'date'|'select'|'textarea'; required?: boolean; options?: string[]; lookup?: Lookup; emptyLabel?: string; }
interface ModuleConfig { title: string; description: string; singular: string; columns: { key:string; label:string }[]; fields: FieldConfig[]; create: 'records'|'activity'|'finance'; empty?: string; }
interface Option { value: string; label: string; }

export const TASK_STATUSES = ['Open','In progress','Completed','Cancelled'];

const CONFIG: Record<string,ModuleConfig> = {
  fields:{title:'Fields and plots',description:'Define farm land units, sizes, soil and current use.',singular:'field',create:'records',columns:[{key:'name',label:'Field'},{key:'size_hectares',label:'Size (ha)'},{key:'soil_type',label:'Soil type'},{key:'status',label:'Status'}],fields:[{key:'name',label:'Field name',required:true},{key:'size_hectares',label:'Size (hectares)',type:'number',required:true},{key:'soil_type',label:'Soil type'},{key:'status',label:'Status',type:'select',options:['Available','In use','Resting'],required:true},{key:'notes',label:'Notes',type:'textarea'}]},
  activities:{title:'Crop activities',description:'Record preparation, planting, inputs, scouting and harvest work against a crop season.',singular:'activity',create:'activity',empty:'Add an open crop season before recording activities.',columns:[{key:'activity_date',label:'Date'},{key:'crop_label',label:'Crop season'},{key:'type',label:'Activity'},{key:'cost_kes',label:'Cost (KES)'},{key:'notes',label:'Notes'}],fields:[{key:'crop_season_id',label:'Crop season',type:'select',lookup:'crops',required:true},{key:'type',label:'Activity',type:'select',options:['Land preparation','Planting','Irrigation','Fertilizer','Spraying','Scouting','Weeding','Harvesting'],required:true},{key:'activity_date',label:'Date',type:'date',required:true},{key:'cost_kes',label:'Cost (KES)',type:'number'},{key:'notes',label:'Notes',type:'textarea'}]},
  health:{title:'Animal health',description:'Record vaccinations, treatments and check-ups, with the next due date.',singular:'health event',create:'activity',empty:'Add an active livestock record before recording health events.',columns:[{key:'event_date',label:'Date'},{key:'animal_label',label:'Animal or group'},{key:'type',label:'Event'},{key:'medicine',label:'Medicine'},{key:'next_due_date',label:'Next due'},{key:'cost_kes',label:'Cost (KES)'}],fields:[{key:'livestock_record_id',label:'Animal or group',type:'select',lookup:'livestock',required:true},{key:'type',label:'Event',type:'select',options:['Vaccination','Treatment','Diagnosis','Deworming','Check-up'],required:true},{key:'event_date',label:'Date',type:'date',required:true},{key:'next_due_date',label:'Next due date',type:'date'},{key:'medicine',label:'Medicine or vaccine'},{key:'cost_kes',label:'Cost (KES)',type:'number'},{key:'notes',label:'Notes',type:'textarea'}]},
  inventory:{title:'Inventory and feed',description:'Track seeds, fertilizer, medicine, chemicals and feed.',singular:'inventory item',create:'records',columns:[{key:'name',label:'Item'},{key:'category',label:'Category'},{key:'quantity',label:'Quantity'},{key:'unit',label:'Unit'},{key:'reorder_level',label:'Reorder at'},{key:'expires_on',label:'Expiry'}],fields:[{key:'name',label:'Item name',required:true},{key:'category',label:'Category',type:'select',options:['Seed','Fertilizer','Medicine','Chemical','Feed','Other'],required:true},{key:'unit',label:'Unit',type:'select',options:['kg','litres','tonnes','units'],required:true},{key:'quantity',label:'Opening quantity',type:'number',required:true},{key:'reorder_level',label:'Reorder level',type:'number',required:true},{key:'expires_on',label:'Expiry date',type:'date'}]},
  tasks:{title:'Farm tasks',description:'Plan work, assign it to farm members and track completion.',singular:'task',create:'records',columns:[{key:'title',label:'Task'},{key:'assignee_name',label:'Assigned to'},{key:'priority',label:'Priority'},{key:'due_date',label:'Due date'},{key:'status',label:'Status'}],fields:[{key:'title',label:'Task title',required:true},{key:'assignee_id',label:'Assigned to',type:'select',lookup:'members',emptyLabel:'Unassigned'},{key:'priority',label:'Priority',type:'select',options:['Low','Medium','High'],required:true},{key:'due_date',label:'Due date',type:'date'},{key:'status',label:'Status',type:'select',options:TASK_STATUSES,required:true},{key:'notes',label:'Instructions',type:'textarea'}]},
  equipment:{title:'Equipment and maintenance',description:'Track farm equipment and upcoming service dates.',singular:'equipment item',create:'records',columns:[{key:'name',label:'Equipment'},{key:'category',label:'Category'},{key:'status',label:'Status'},{key:'next_service_date',label:'Next service'},{key:'maintenance_cost_kes',label:'Cost (KES)'}],fields:[{key:'name',label:'Equipment name',required:true},{key:'category',label:'Category',type:'select',options:['Tractor','Pump','Sprayer','Vehicle','Tool','Other'],required:true},{key:'status',label:'Status',type:'select',options:['Operational','Maintenance','Out of service'],required:true},{key:'next_service_date',label:'Next service date',type:'date'},{key:'maintenance_cost_kes',label:'Maintenance cost (KES)',type:'number'}]},
  finance:{title:'Farm finance',description:'Record KES income and expenses.',singular:'transaction',create:'finance',columns:[{key:'transaction_date',label:'Date'},{key:'type',label:'Type'},{key:'category',label:'Category'},{key:'party',label:'Buyer / supplier'},{key:'amount_kes',label:'Amount (KES)'}],fields:[{key:'type',label:'Type',type:'select',options:['Income','Expense'],required:true},{key:'category',label:'Category',required:true},{key:'transaction_date',label:'Date',type:'date',required:true},{key:'amount_kes',label:'Amount (KES)',type:'number',required:true},{key:'party',label:'Buyer or supplier'},{key:'notes',label:'Notes',type:'textarea'}]},
};

@Component({selector:'app-farm-module',imports:[FormsModule,DxTemplateDirective,DxDataGridComponent,DxiDataGridColumnComponent],templateUrl:'./farm-module.html',styleUrls:['./farm-module.css','./farm-fluid.css','./farm-collab.css']})
export class FarmModule implements OnInit {
  private readonly service=inject(FarmService); private readonly route=inject(ActivatedRoute); private readonly auth=inject(AuthService);
  readonly module=signal('fields'); readonly farms=signal<Farm[]>([]); readonly farm=signal<Farm|null>(null);
  readonly records=signal<Record<string,unknown>[]>([]); readonly open=signal(false); readonly busy=signal(false); readonly error=signal('');
  readonly editingId=signal<string|null>(null);
  readonly lookups=signal<Record<Lookup,Option[]>>({crops:[],livestock:[],members:[]});
  readonly statusTask=signal<Record<string,unknown>|null>(null);
  readonly statuses=TASK_STATUSES;
  statusDraft='Open';
  draft:Record<string,any>={};
  get config():ModuleConfig{return CONFIG[this.module()];}
  readonly role=computed(()=>this.farm()?.role??null);
  /** Finance is visible to Owners only; every other module is visible to all members. */
  readonly canView=computed(()=>this.config.create!=='finance'||farmCan.finance(this.role()));
  readonly canCreate=computed(()=>{const role=this.role();const kind=this.config.create;return kind==='activity'?!!role:kind==='finance'?farmCan.finance(role):farmCan.manageRecords(role);});
  readonly canEdit=computed(()=>this.config.create==='finance'?farmCan.finance(this.role()):farmCan.manageRecords(this.role()));
  readonly missingLookup=computed(()=>this.config.fields.some(f=>f.lookup&&f.required&&!this.lookups()[f.lookup].length));
  async ngOnInit(){this.module.set(this.route.snapshot.data['module']);this.reset();await this.loadFarms();}
  reset(){this.draft={};for(const field of this.config.fields){if(field.lookup)this.draft[field.key]=field.emptyLabel?'':(this.lookups()[field.lookup][0]?.value??'');else if(field.options?.length)this.draft[field.key]=field.options[0];else if(field.type==='number')this.draft[field.key]=0;else this.draft[field.key]='';}}
  options(field:FieldConfig):Option[]{return field.lookup?this.lookups()[field.lookup]:(field.options??[]).map(value=>({value,label:value}));}
  async loadFarms(){this.busy.set(true);try{const farms=await this.service.farms();this.farms.set(farms);const selected=this.service.pickFarm(farms);if(selected)await this.selectFarm(selected.id);}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
  async selectFarm(id:string){const farm=this.farms().find(f=>f.id===id)??null;this.farm.set(farm);this.records.set([]);if(!farm)return;this.service.selectFarm(id);if(!this.canView())return;this.busy.set(true);this.error.set('');try{const [records]=await Promise.all([this.service.operations(id,this.module()),this.loadLookups(id)]);this.records.set(records);}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
  private async loadLookups(id:string){
    const needed=new Set(this.config.fields.map(f=>f.lookup).filter((l):l is Lookup=>!!l));
    const next:Record<Lookup,Option[]>={crops:[],livestock:[],members:[]};
    if(needed.has('crops'))next.crops=(await this.service.crops(id)).data.filter(c=>!['Completed','Cancelled'].includes(c.status)).map(c=>({value:c.id,label:`${c.crop}${c.variety?' '+c.variety:''} · ${c.field_name} (${c.status})`}));
    if(needed.has('livestock'))next.livestock=(await this.service.livestock(id)).data.filter(l=>l.status==='Active').map(l=>({value:l.id,label:`${l.tag_number??l.group_name} · ${l.species}${l.tracking_type==='Group'?' ('+l.quantity+')':''}`}));
    if(needed.has('members'))next.members=(await this.service.members(id)).map(m=>({value:String(m.id),label:`${m.name} (${m.role})`}));
    this.lookups.set(next);
  }
  /** Workers may only change the status of tasks assigned to them. */
  canUpdateStatus(record:Record<string,unknown>):boolean{return this.module()==='tasks'&&!this.canEdit()&&record['assignee_id']!=null&&Number(record['assignee_id'])===this.auth.userId();}
  showForm(){this.editingId.set(null);this.reset();this.open.set(true);}
  edit(record:Record<string,unknown>){this.editingId.set(String(record['id']));this.draft={};for(const field of this.config.fields){const value=record[field.key];this.draft[field.key]=value==null?'':field.lookup==='members'?String(value):value;}this.open.set(true);}
  openStatus(record:Record<string,unknown>){this.statusDraft=String(record['status']);this.statusTask.set(record);}
  async saveStatus(){const farm=this.farm();const task=this.statusTask();if(!farm||!task)return;await this.run(async()=>{await this.service.updateTaskStatus(farm.id,String(task['id']),this.statusDraft);this.statusTask.set(null);});}
  async save(){const farm=this.farm();if(!farm)return;const payload={...this.draft};for(const field of this.config.fields)if(field.lookup==='members')payload[field.key]=payload[field.key]?Number(payload[field.key]):null;await this.run(async()=>{const id=this.editingId();if(id)await this.service.updateOperation(farm.id,this.module(),id,payload);else await this.service.createOperation(farm.id,this.module(),payload);this.open.set(false);this.editingId.set(null);});}
  private async run(task:()=>Promise<void>){const farm=this.farm();if(!farm)return;this.busy.set(true);this.error.set('');try{await task();this.records.set(await this.service.operations(farm.id,this.module()));}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
}
