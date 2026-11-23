<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LivestockRecord extends Model
{
    use HasUuids;
    protected $fillable = ['tracking_type', 'tag_number', 'group_name', 'species', 'breed', 'sex', 'quantity', 'birth_date', 'status', 'location', 'notes'];
    protected $casts = ['birth_date' => 'date:Y-m-d', 'quantity' => 'integer'];
}
