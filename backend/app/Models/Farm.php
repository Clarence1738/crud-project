<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Farm extends Model
{
    use HasUuids;
    protected $fillable = ['name', 'county', 'location', 'size_hectares', 'notes'];
    protected $casts = ['size_hectares' => 'decimal:2'];
}
