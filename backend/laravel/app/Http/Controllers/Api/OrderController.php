<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function index()
    {
        return Order::latest()->paginate(20);
    }

    public function store(Request $request)
    {
        // Validaciones básicas (mejor con FormRequest)
        $data = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'items' => 'required|array|min:1',
            'items.*.title' => 'required|string',
            'items.*.price' => 'required|numeric|min:0',
            'items.*.qty' => 'required|integer|min:1'
        ]);

        // Calcular total en servidor
        $total = 0;
        foreach ($data['items'] as $it) {
            $total += $it['price'] * ($it['qty'] ?? 1);
        }

        $orderNumber = 'RS-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));

        $order = Order::create([
            'customer_id' => $data['customer_id'] ?? null,
            'order_number' => $orderNumber,
            'items' => $data['items'],
            'total' => $total,
            'currency' => $request->input('currency','MXN'),
            'status' => 'created'
        ]);

        return response()->json($order, 201);
    }

    public function show(Order $order)
    {
        return $order->load('customer','invoice');
    }
}
