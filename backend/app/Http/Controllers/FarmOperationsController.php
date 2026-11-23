<?php

namespace App\Http\Controllers;

use App\Models\Farm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FarmOperationsController extends Controller
{
    private const MODULES = [
        'fields' => ['farm_fields', ['name','size_hectares','soil_type','status','notes']],
        'activities' => ['crop_activities', ['crop_season_id','type','activity_date','cost_kes','notes']],
        'health' => ['livestock_events', ['livestock_record_id','type','event_date','next_due_date','cost_kes','medicine','notes']],
        'inventory' => ['inventory_items', ['name','category','unit','quantity','reorder_level','expires_on']],
        'tasks' => ['farm_tasks', ['title','priority','due_date','status','notes']],
        'equipment' => ['farm_equipment', ['name','category','status','next_service_date','maintenance_cost_kes']],
        'finance' => ['farm_transactions', ['type','category','transaction_date','amount_kes','party','notes']],
    ];

    public function index(Request $request, Farm $farm, string $module): JsonResponse
    {
        [$table] = $this->module($module); $this->access($request,$farm);
        return response()->json(['data' => DB::table($table)->where('farm_id',$farm->id)->orderByDesc('created_at')->get()]);
    }

    public function store(Request $request, Farm $farm, string $module): JsonResponse
    {
        [$table,$columns] = $this->module($module); $this->access($request,$farm);
        $rules = $this->rules($module); $data = $request->validate($rules);
        $id = (string) \Illuminate\Support\Str::uuid();
        DB::table($table)->insert([...array_intersect_key($data,array_flip($columns)),'id'=>$id,'farm_id'=>$farm->id,'created_at'=>now(),'updated_at'=>now()]);
        return response()->json(['data'=>DB::table($table)->find($id)],201);
    }

    public function update(Request $request, Farm $farm, string $module, string $record): JsonResponse
    {
        [$table,$columns] = $this->module($module); $this->access($request,$farm);
        abort_unless(DB::table($table)->where('id',$record)->where('farm_id',$farm->id)->exists(),404);
        $data = $request->validate($this->rules($module));
        DB::table($table)->where('id',$record)->where('farm_id',$farm->id)
            ->update([...array_intersect_key($data,array_flip($columns)),'updated_at'=>now()]);
        return response()->json(['data'=>DB::table($table)->find($record)]);
    }

    private function module(string $module): array { abort_unless(isset(self::MODULES[$module]),404); return self::MODULES[$module]; }
    private function access(Request $r,Farm $f): void { abort_unless(DB::table('farm_memberships')->where('farm_id',$f->id)->where('user_id',$r->user()->id)->exists(),404); }
    private function rules(string $m): array
    {
        return match($m) {
            'fields'=>['name'=>['required','string','max:100'],'size_hectares'=>['required','numeric','gt:0'],'soil_type'=>['nullable','string','max:80'],'status'=>['required',Rule::in(['Available','In use','Resting'])],'notes'=>['nullable','string','max:2000']],
            'activities'=>['crop_season_id'=>['required','uuid'],'type'=>['required','string','max:40'],'activity_date'=>['required','date'],'cost_kes'=>['nullable','numeric','min:0'],'notes'=>['nullable','string','max:2000']],
            'health'=>['livestock_record_id'=>['required','uuid'],'type'=>['required','string','max:40'],'event_date'=>['required','date'],'next_due_date'=>['nullable','date'],'cost_kes'=>['nullable','numeric','min:0'],'medicine'=>['nullable','string','max:120'],'notes'=>['nullable','string','max:2000']],
            'inventory'=>['name'=>['required','string','max:120'],'category'=>['required','string','max:40'],'unit'=>['required',Rule::in(['kg','litres','tonnes','units'])],'quantity'=>['required','numeric','min:0'],'reorder_level'=>['required','numeric','min:0'],'expires_on'=>['nullable','date']],
            'tasks'=>['title'=>['required','string','max:160'],'priority'=>['required',Rule::in(['Low','Medium','High'])],'due_date'=>['nullable','date'],'status'=>['required',Rule::in(['Open','In progress','Completed','Cancelled'])],'notes'=>['nullable','string','max:2000']],
            'equipment'=>['name'=>['required','string','max:120'],'category'=>['required','string','max:60'],'status'=>['required',Rule::in(['Operational','Maintenance','Out of service'])],'next_service_date'=>['nullable','date'],'maintenance_cost_kes'=>['nullable','numeric','min:0']],
            'finance'=>['type'=>['required',Rule::in(['Income','Expense'])],'category'=>['required','string','max:60'],'transaction_date'=>['required','date'],'amount_kes'=>['required','numeric','gt:0'],'party'=>['nullable','string','max:120'],'notes'=>['nullable','string','max:2000']],
        };
    }
}
