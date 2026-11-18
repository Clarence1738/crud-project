<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Transport extends Model
{
    use HasUuids;

    protected $fillable = ['customer', 'origin', 'destination', 'vehicle', 'date', 'status'];

    protected $hidden = ['user_id'];
}
