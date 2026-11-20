<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TransportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'customer' => ['sometimes', 'required', 'string', 'max:120'],
            'sender_company' => ['required', 'string', 'max:120'],
            'recipient_company' => ['required', 'string', 'max:120'],
            'origin' => ['required', 'string', 'max:100'],
            'destination' => ['required', 'string', 'max:100'],
            'vehicle' => ['required', 'string', 'max:30'],
            'date' => ['required', 'date_format:Y-m-d'],
            'expected_arrival_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date'],
            'reference' => ['nullable', 'string', 'max:80'],
            'goods_description' => ['nullable', 'string', 'max:500'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:2147483647'],
            'status' => ['required', Rule::in(['Scheduled', 'In transit', 'Delivered'])],
            'user_id' => ['prohibited'],
            'promised_arrival_date' => ['prohibited'],
        ];
    }
}
