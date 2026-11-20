<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Transport extends Model
{
    use HasUuids;

    protected $fillable = ['customer', 'sender_company', 'recipient_company', 'origin', 'destination', 'vehicle', 'date', 'expected_arrival_date', 'status', 'reference', 'goods_description', 'quantity'];

    protected $casts = [
        'delivered_at' => 'datetime',
        'reported_transit_started_at' => 'datetime',
        'quantity' => 'integer',
    ];

    protected $hidden = ['user_id'];

    protected function recipientCompany(): Attribute
    {
        return Attribute::get(fn (?string $value): string => $value ?? $this->customer);
    }
}
