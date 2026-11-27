<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('farm:make-admin {email}', function (string $email) {
    $updated = User::where('email', $email)->update(['is_admin' => true]);
    $updated ? $this->info("{$email} is now a System Administrator.") : $this->error("No account uses {$email}.");
})->purpose('Give an existing account the System Administrator role');

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
