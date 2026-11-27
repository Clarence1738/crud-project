<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\FarmController;
use App\Http\Controllers\FarmMemberController;
use App\Http\Controllers\FarmOperationsController;
use App\Http\Controllers\FarmSettingsController;
use App\Http\Controllers\ProductionController;
use App\Http\Controllers\TransportController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::prefix('api')->middleware('private.responses')->group(function (): void {
    Route::get('csrf', fn () => response()->json(['token' => csrf_token()]));
    Route::post('register', [AuthController::class, 'register_user'])->middleware('throttle:6,1');
    Route::post('login', [AuthController::class, 'login_user'])->middleware('throttle:login');

    Route::middleware(['auth', 'active.account'])->group(function (): void {
        Route::get('me', [AuthController::class, 'show_authenticated_user']);
        Route::get('record-revisions', function (Request $request) {
            $revisions = DB::table('record_revisions')->where('user_id', $request->user()->id)
                ->pluck('revision', 'resource');

            return response()->json([
                'transports' => (string) ($revisions['transports'] ?? 0),
                'documents' => (string) ($revisions['documents'] ?? 0),
                'date' => now('Africa/Nairobi')->toDateString(),
            ]);
        });
        Route::post('logout', [AuthController::class, 'logout_user']);
        Route::get('farms', [FarmController::class, 'index']);
        Route::post('farms', [FarmController::class, 'store']);
        Route::put('farms/{farm}', [FarmController::class, 'update']);
        Route::get('farms/{farm}/overview', [FarmController::class, 'overview']);
        Route::get('farms/{farm}/crops', [FarmController::class, 'crops']);
        Route::post('farms/{farm}/crops', [FarmController::class, 'storeCrop']);
        Route::put('farms/{farm}/crops/{crop}', [FarmController::class, 'updateCrop']);
        Route::patch('farms/{farm}/crops/{crop}/archive', [FarmController::class, 'archiveCrop']);
        Route::get('farms/{farm}/livestock', [FarmController::class, 'livestock']);
        Route::post('farms/{farm}/livestock', [FarmController::class, 'storeLivestock']);
        Route::put('farms/{farm}/livestock/{livestock}', [FarmController::class, 'updateLivestock']);
        Route::patch('farms/{farm}/livestock/{livestock}/archive', [FarmController::class, 'archiveLivestock']);
        Route::get('farms/{farm}/settings', [FarmSettingsController::class, 'show']);
        Route::put('farms/{farm}/settings', [FarmSettingsController::class, 'update']);
        Route::get('admin/users', [AdminController::class, 'users']);
        Route::patch('admin/users/{user}/status', [AdminController::class, 'updateStatus'])->whereNumber('user');
        Route::get('farms/{farm}/members', [FarmMemberController::class, 'index']);
        Route::patch('farms/{farm}/members/{user}', [FarmMemberController::class, 'updateRole'])->whereNumber('user');
        Route::delete('farms/{farm}/members/{user}', [FarmMemberController::class, 'destroy'])->whereNumber('user');
        Route::get('farms/{farm}/invitations', [FarmMemberController::class, 'invitations']);
        Route::post('farms/{farm}/invitations', [FarmMemberController::class, 'invite'])->middleware('throttle:20,1');
        Route::delete('farms/{farm}/invitations/{invitation}', [FarmMemberController::class, 'revoke'])->whereUuid('invitation');
        Route::post('farm-invitations/accept', [FarmMemberController::class, 'accept'])->middleware('throttle:10,1');
        Route::patch('farms/{farm}/tasks/{task}/status', [FarmOperationsController::class, 'updateTaskStatus'])->whereUuid('task');
        Route::get('farms/{farm}/production/sheet', [ProductionController::class, 'sheet']);
        Route::post('farms/{farm}/production/sheet', [ProductionController::class, 'saveSheet']);
        Route::get('farms/{farm}/production/summary', [ProductionController::class, 'summary']);
        Route::get('farms/{farm}/operations/{module}', [FarmOperationsController::class, 'index']);
        Route::post('farms/{farm}/operations/{module}', [FarmOperationsController::class, 'store']);
        Route::put('farms/{farm}/operations/{module}/{record}', [FarmOperationsController::class, 'update'])->whereUuid('record');
        Route::delete('farms/{farm}/operations/{module}/{record}', [FarmOperationsController::class, 'destroy'])->whereUuid('record');
        Route::get('transports', [TransportController::class, 'index_transports'])->name('transports.index');
        Route::get('transports/calendar', [TransportController::class, 'calendar']);
        Route::get('transports/analytics', [TransportController::class, 'analytics']);
        Route::get('transports/export', [TransportController::class, 'export']);
        Route::patch('transports/{transport}/status', [TransportController::class, 'update_transport_status']);
        Route::post('transports', [TransportController::class, 'store_transport'])->name('transports.store');
        Route::get('transports/{transport}', [TransportController::class, 'show_transport'])->name('transports.show');
        Route::match(['put', 'patch'], 'transports/{transport}', [TransportController::class, 'update_transport'])->name('transports.update');
        Route::delete('transports/{transport}', [TransportController::class, 'destroy_transport'])->name('transports.destroy');
        Route::get('documents/{document}/download', [DocumentController::class, 'download_document']);
        Route::get('documents', [DocumentController::class, 'index_documents'])->name('documents.index');
        Route::post('documents', [DocumentController::class, 'store_document'])->name('documents.store');
        Route::get('documents/{document}', [DocumentController::class, 'show_document'])->name('documents.show');
        Route::match(['put', 'patch'], 'documents/{document}', [DocumentController::class, 'update_document'])->name('documents.update');
        Route::delete('documents/{document}', [DocumentController::class, 'destroy_document'])->name('documents.destroy');
    });
});
