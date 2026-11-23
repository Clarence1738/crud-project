<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CropSeason extends Model
{
    use HasUuids;
    protected $fillable = ['field_id', 'crop', 'variety', 'field_name', 'area_hectares', 'planted_on', 'expected_harvest_date', 'status', 'expected_yield_kg', 'harvested_kg', 'notes'];
    protected $casts = ['planted_on' => 'date:Y-m-d', 'expected_harvest_date' => 'date:Y-m-d', 'area_hectares' => 'decimal:2', 'expected_yield_kg' => 'decimal:2', 'harvested_kg' => 'decimal:2'];
}
