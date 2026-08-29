<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\InteractionController;
use App\Http\Controllers\Api\EvaluationController;

Route::post('login', [\App\Http\Controllers\Api\AuthController::class, 'login']);
Route::post('register', [\App\Http\Controllers\Api\AuthController::class, 'register']);

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('orders', OrderController::class)->only(['index','store','show']);
    Route::apiResource('invoices', InvoiceController::class)->only(['store','show']);
    Route::apiResource('interactions', InteractionController::class)->only(['index','store']);
    Route::apiResource('evaluations', EvaluationController::class)->only(['index','store']);
    Route::get('dashboard/summary', [\App\Http\Controllers\Api\DashboardController::class, 'summary']);
});
