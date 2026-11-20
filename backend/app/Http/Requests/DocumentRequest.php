<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\File;

class DocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'file' => [$this->isMethod('POST') && ! $this->route('document') ? 'required' : 'sometimes', 'extensions:pdf,jpg,jpeg,png,txt,csv', File::types(['pdf', 'jpg', 'jpeg', 'png', 'txt', 'csv'])->max(10240)],
            'user_id' => ['prohibited'],
            'path' => ['prohibited'],
            'transport_id' => [$this->route('document') ? 'prohibited' : 'nullable', 'uuid'],
        ];
    }
}
