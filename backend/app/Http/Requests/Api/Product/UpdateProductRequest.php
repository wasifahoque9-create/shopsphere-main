<?php

namespace App\Http\Requests\Api\Product;

use App\Enums\ProductStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    /**
     * Determine whether the user is authorized
     * to make this request.
     *
     * Access control is handled by the route middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $product = $this->route('product');

        $productId = is_object($product)
            ? $product->id
            : $product;

        return [
            /*
            |--------------------------------------------------------------------------
            | Product category
            |--------------------------------------------------------------------------
            |
            | If category_id is provided, it MUST be a subcategory.
            |
            | Main category:
            |     parent_id = NULL
            |
            | Subcategory:
            |     parent_id != NULL
            |
            */

            'category_id' => [
                'sometimes',
                'required',
                'integer',
                Rule::exists('categories', 'id')
                    ->whereNotNull('parent_id'),
            ],

            /*
            |--------------------------------------------------------------------------
            | Basic product information
            |--------------------------------------------------------------------------
            */

            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],

            'slug' => [
                'sometimes',
                'nullable',
                'string',
                'max:255',
                Rule::unique('products', 'slug')
                    ->ignore($productId),
            ],

            'brand' => [
                'sometimes',
                'nullable',
                'string',
                'max:100',
            ],

            'description' => [
                'sometimes',
                'nullable',
                'string',
            ],

            /*
            |--------------------------------------------------------------------------
            | Product price and stock
            |--------------------------------------------------------------------------
            */

            'price' => [
                'sometimes',
                'required',
                'numeric',
                'min:0',
            ],

            'discount_price' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
                'lte:price',
            ],

            'stock_qty' => [
                'sometimes',
                'required',
                'integer',
                'min:0',
            ],

            /*
            |--------------------------------------------------------------------------
            | Product status
            |--------------------------------------------------------------------------
            */

            'status' => [
                'sometimes',
                'required',
                Rule::enum(ProductStatus::class),
            ],

            /*
            |--------------------------------------------------------------------------
            | Product specifications
            |--------------------------------------------------------------------------
            */

            'specifications' => [
                'sometimes',
                'nullable',
                'array',
            ],

            'specifications.*' => [
                'nullable',
            ],

            /*
            |--------------------------------------------------------------------------
            | Warranty
            |--------------------------------------------------------------------------
            */

            'warranty_months' => [
                'sometimes',
                'nullable',
                'integer',
                'min:0',
                'max:240',
            ],

            /*
            |--------------------------------------------------------------------------
            | Product SKU
            |--------------------------------------------------------------------------
            */

            'sku' => [
                'sometimes',
                'nullable',
                'string',
                'max:100',
                Rule::unique('products', 'sku')
                    ->ignore($productId),
            ],

            /*
            |--------------------------------------------------------------------------
            | Product images
            |--------------------------------------------------------------------------
            |
            | Maximum 8 images.
            | Each image can be maximum 5 MB.
            |
            */

            'images' => [
                'sometimes',
                'nullable',
                'array',
                'max:8',
            ],

            'images.*' => [
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],

            /*
            |--------------------------------------------------------------------------
            | Product variants
            |--------------------------------------------------------------------------
            */

            'variants' => [
                'sometimes',
                'nullable',
                'array',
            ],

            'variants.*' => [
                'array',
            ],

            'variants.*.variant_name' => [
                'required',
                'string',
                'max:100',
            ],

            'variants.*.variant_value' => [
                'required',
                'string',
                'max:100',
            ],

            'variants.*.price_adjustment' => [
                'sometimes',
                'nullable',
                'numeric',
            ],

            'variants.*.stock_qty' => [
                'sometimes',
                'nullable',
                'integer',
                'min:0',
            ],

            'variants.*.sku' => [
                'sometimes',
                'nullable',
                'string',
                'max:100',
            ],
        ];
    }

    /**
     * Get custom validation messages.
     */
    public function messages(): array
    {
        return [
            'category_id.required' =>
                'Please select a product subcategory.',

            'category_id.integer' =>
                'The selected product subcategory is invalid.',

            'category_id.exists' =>
                'The selected product category must be a valid subcategory.',

            'name.required' =>
                'The product name is required.',

            'price.required' =>
                'The product price is required.',

            'price.min' =>
                'The product price cannot be negative.',

            'discount_price.min' =>
                'The discount price cannot be negative.',

            'discount_price.lte' =>
                'The discount price cannot be greater than the regular price.',

            'stock_qty.required' =>
                'The product stock quantity is required.',

            'stock_qty.min' =>
                'The product stock quantity cannot be negative.',

            'slug.unique' =>
                'Another product is already using this slug.',

            'sku.unique' =>
                'Another product is already using this SKU.',

            'warranty_months.min' =>
                'Warranty months cannot be negative.',

            'warranty_months.max' =>
                'Warranty cannot exceed 240 months.',

            'images.max' =>
                'You may upload a maximum of 8 images.',

            'images.*.image' =>
                'Every uploaded file must be a valid image.',

            'images.*.mimes' =>
                'Images must be JPG, JPEG, PNG, or WebP.',

            'images.*.max' =>
                'Each image must not be larger than 5 MB.',

            'variants.*.variant_name.required' =>
                'Every variant must contain a variant name.',

            'variants.*.variant_value.required' =>
                'Every variant must contain a variant value.',
        ];
    }
}