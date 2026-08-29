<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class InvoiceController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'order_id' => 'required|exists:orders,id',
            'fiscal_data' => 'nullable|array'
        ]);

        $order = Order::findOrFail($data['order_id']);
        $invoiceNumber = 'F-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));

        $invoice = Invoice::create([
            'order_id' => $order->id,
            'invoice_number' => $invoiceNumber,
            'fiscal_data' => $data['fiscal_data'] ?? null,
            'total' => $order->total
        ]);

        return response()->json($invoice, 201);
    }

    public function show(Invoice $invoice)
    {
        return $invoice->load('order');
    }
}
