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
            'customer' => ['required', 'string', 'max:120'],
            'origin' => ['required', 'string', 'max:100'],
            'destination' => ['required', 'string', 'max:100'],
            'vehicle' => ['required', 'string', 'max:30'],
            'date' => ['required', 'date_format:Y-m-d'],
            'status' => ['required', Rule::in(['Scheduled', 'In transit', 'Delivered'])],
            'user_id' => ['prohibited'],
        ];
    }
}
