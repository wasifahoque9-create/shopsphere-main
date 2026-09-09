import type {
  Address,
  ApiMessage,
  AuthResponse,
  Cart,
  Category,
  DashboardStats,
  Order,
  PaginatedResponse,
  Product,
  ProductFilters,
  ProductVariant,
  Review,
  ReviewsResponse,
  User,
} from "@/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api";

export const STORAGE_BASE =
  process.env.NEXT_PUBLIC_STORAGE_URL ||
  "http://localhost:8000/storage";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/*
|--------------------------------------------------------------------------
| Authentication token
|--------------------------------------------------------------------------
*/

function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("token");
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

/*
|--------------------------------------------------------------------------
| Query-string helper
|--------------------------------------------------------------------------
*/

function buildQuery(
  params?: Record<
    string,
    string | number | boolean | undefined
  >,
): string {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

/*
|--------------------------------------------------------------------------
| Main API request helper
|--------------------------------------------------------------------------
|
| This helper supports:
| - JSON requests
| - Multipart FormData requests
| - Bearer-token authentication
| - Laravel validation errors
|
*/

export async function api<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  /*
   * Do not manually add Content-Type for FormData.
   * The browser automatically adds the correct multipart boundary.
   */
  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(
    `${API_BASE}${endpoint}`,
    {
      ...options,
      headers,
    },
  );

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({}));

    throw new ApiError(
      response.status,
      body.message || "Something went wrong.",
      body.errors,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

/*
|--------------------------------------------------------------------------
| API response helper
|--------------------------------------------------------------------------
*/

function unwrap<T>(
  payload: T | { data: T },
): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

/*
|--------------------------------------------------------------------------
| Product helpers
|--------------------------------------------------------------------------
*/

export function getProductPrice(
  product: Product,
  variant?: ProductVariant | null,
): number {
  const basePrice = Number(
    product.discount_price ??
      product.effective_price ??
      product.price,
  );

  if (
    variant &&
    "price_adjustment" in variant
  ) {
    return (
      basePrice +
      Number(variant.price_adjustment ?? 0)
    );
  }

  return basePrice;
}

export function getVariantLabel(
  variant: ProductVariant,
): string {
  return `${variant.variant_name}: ${variant.variant_value}`;
}

export function getProductImage(
  product: Product,
): string {
  const images = product.images ?? [];

  const selectedImage =
    images.find((image) => image.is_primary) ??
    images[0];

  if (!selectedImage) {
    return "/placeholder-product.svg";
  }

  /*
   * Prefer the optimized thumbnail for product
   * cards, tables, and other small image displays.
   */
  if (selectedImage.thumbnail_url) {
    return selectedImage.thumbnail_url;
  }

  /*
   * Fall back to the optimized main image when
   * thumbnail_url is not available.
   */
  if (selectedImage.url) {
    return selectedImage.url;
  }

  /*
   * The backend field is image_path, not path.
   *
   * Nested paths such as:
   * products/laptop/novabook-pro-15.jpg
   * are supported automatically.
   */
  if (selectedImage.image_path) {
    if (
      selectedImage.image_path.startsWith("http://") ||
      selectedImage.image_path.startsWith("https://")
    ) {
      return selectedImage.image_path;
    }

    const cleanPath = selectedImage.image_path
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/^storage\//, "");

    return `${STORAGE_BASE}/${cleanPath}`;
  }

  return "/placeholder-product.svg";
}
export function formatPrice(
  amount: number,
): string {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatOrderNumber(
  order: Pick<Order, "id">,
): string {
  return `#${String(order.id).padStart(6, "0")}`;
}

/*
|--------------------------------------------------------------------------
| Authentication API
|--------------------------------------------------------------------------
*/

export const authApi = {
  register: (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    phone?: string;
  }) =>
    api<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: {
    email: string;
    password: string;
  }) =>
    api<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () =>
    api<ApiMessage>("/auth/logout", {
      method: "POST",
    }),

  forgotPassword: (data: {
    email: string;
  }) =>
    api<ApiMessage>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getUser: async (): Promise<User> => {
    const response = await api<{
      user: User;
    }>("/users/me");

    return response.user;
  },
};

/*
|--------------------------------------------------------------------------
| Customer catalog API
|--------------------------------------------------------------------------
*/

export const catalogApi = {
  getCategories: () =>
    api<
      Category[] | { data: Category[] }
    >("/categories").then(unwrap),

  getFeaturedProducts: () =>
    api<PaginatedResponse<Product>>(
      "/products?per_page=8",
    ).then((response) => response.data),

  getProducts: (
    filters?: ProductFilters,
  ) =>
    api<PaginatedResponse<Product>>(
      `/products${buildQuery(
        filters as Record<
          string,
          string | number | boolean | undefined
        >,
      )}`,
    ),

  getCategoryProducts: (
    slug: string,
    filters?: ProductFilters,
  ) =>
    api<PaginatedResponse<Product>>(
      `/products${buildQuery({
        ...(filters as Record<
          string,
          string | number | boolean | undefined
        >),
        category_slug: slug,
      })}`,
    ),

  getProduct: (
    slugOrId: string | number,
  ) =>
    api<Product | { data: Product }>(
      `/products/${slugOrId}`,
    ).then(unwrap),

  search: (
    search: string,
    page = 1,
  ) =>
    api<PaginatedResponse<Product>>(
      `/products${buildQuery({
        search,
        page,
      })}`,
    ),

  getProductReviews: async (
    slugOrId: string | number,
  ): Promise<Review[]> => {
    const response =
      await api<ReviewsResponse>(
        `/reviews/product/${slugOrId}`,
      );

    return response.data;
  },

  createReview: (
    productId: number,
    data: {
      rating: number;
      comment: string;
    },
  ) =>
    api<Review | { data: Review }>(
      "/reviews",
      {
        method: "POST",
        body: JSON.stringify({
          product_id: productId,
          ...data,
        }),
      },
    ).then(unwrap),
};

/*
|--------------------------------------------------------------------------
| Cart API
|--------------------------------------------------------------------------
*/

export const cartApi = {
  get: async (): Promise<Cart> => {
    const response = await api<{
      cart: {
        id: number;
        items: Cart["items"];
      };
      subtotal: number;
      discount_total: number;
      total: number;
      item_count: number;
    }>("/cart");

    return {
      id: response.cart.id,
      items: response.cart.items ?? [],
      subtotal: response.subtotal,
      discount_total:
        response.discount_total,
      total: response.total,
      item_count: response.item_count,
    };
  },

  addItem: async (data: {
    product_id: number;
    product_variant_id?: number | null;
    quantity: number;
  }) => {
    await api("/cart/add", {
      method: "POST",
      body: JSON.stringify(data),
    });

    return cartApi.get();
  },

  updateItem: async (
    cartItemId: number,
    quantity: number,
  ) => {
    await api("/cart/update", {
      method: "PUT",
      body: JSON.stringify({
        cart_item_id: cartItemId,
        quantity,
      }),
    });

    return cartApi.get();
  },

  removeItem: async (
    cartItemId: number,
  ) => {
    await api("/cart/remove", {
      method: "DELETE",
      body: JSON.stringify({
        cart_item_id: cartItemId,
      }),
    });

    return cartApi.get();
  },
};

/*
|--------------------------------------------------------------------------
| Profile API
|--------------------------------------------------------------------------
*/

export const profileApi = {
  update: (data: {
    name?: string;
    email?: string;
    phone?: string;
    addresses?: Partial<Address>[];
  }) =>
    api<{ user: User }>(
      "/users/profile",
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    ).then((response) => response.user),

  changePassword: (data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }) =>
    api<ApiMessage>(
      "/users/change-password",
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    ),
};

export const addressApi = {
  list: async (): Promise<Address[]> => {
    const user = await authApi.getUser();

    return user.addresses ?? [];
  },

  create: async (
    data: Omit<Address, "id">,
  ) => {
    const user = await profileApi.update({
      addresses: [data],
    });

    return user.addresses?.slice(
      -1,
    )[0] as Address;
  },
};

/*
|--------------------------------------------------------------------------
| Order API
|--------------------------------------------------------------------------
*/

export const orderApi = {
  list: (page = 1) =>
    api<PaginatedResponse<Order>>(
      `/orders${buildQuery({ page })}`,
    ),

  get: (id: number | string) =>
    api<Order | { data: Order }>(
      `/orders/${id}`,
    ).then(unwrap),

  checkout: (data: {
    shipping_address_id: number;
    payment_method: "cod" | "gateway";
    gateway_payload?: Record<
      string,
      unknown
    >;
  }) =>
    api<Order | { data: Order }>(
      "/orders",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ).then(unwrap),

  cancel: (id: number | string) =>
    api<Order | { data: Order }>(
      `/orders/${id}/cancel`,
      {
        method: "PUT",
      },
    ).then(unwrap),
};

/*
|--------------------------------------------------------------------------
| Admin API
|--------------------------------------------------------------------------
*/

export const adminApi = {
  dashboard: () =>
    api<DashboardStats>(
      "/admin/dashboard",
    ),

  /*
  |--------------------------------------------------------------------------
  | Admin Products
  |--------------------------------------------------------------------------
  */

  products: {
    /*
     * Admin product list.
     * This returns active, draft, and archived products.
     */
    list: (params?: {
      page?: number;
      per_page?: number;
      search?: string;
      category_id?: number;
      status?: string;
      sort_by?:
        | "name"
        | "price"
        | "stock_qty"
        | "created_at";
      sort_direction?: "asc" | "desc";
    }) =>
      api<PaginatedResponse<Product>>(
        `/admin/products${buildQuery({
          page: params?.page ?? 1,
          per_page:
            params?.per_page ?? 20,
          search: params?.search,
          category_id:
            params?.category_id,
          status: params?.status,
          sort_by: params?.sort_by,
          sort_direction:
            params?.sort_direction,
        })}`,
      ),

    /*
     * Get one product for the admin Edit Product page.
     */
    get: (id: number) =>
      api<Product | { data: Product }>(
        `/admin/products/${id}`,
      ).then(unwrap),

    /*
     * Create supports both JSON and FormData.
     *
     * FormData is used when uploading a product image.
     */
    create: (
      data:
        | FormData
        | Record<string, unknown>,
    ) =>
      api<Product | { data: Product }>(
        "/admin/products",
        {
          method: "POST",
          body:
            typeof FormData !==
              "undefined" &&
            data instanceof FormData
              ? data
              : JSON.stringify(data),
        },
      ).then(unwrap),

    /*
     * Update supports both normal JSON
     * and FormData for image replacement.
     */
    update: (
      id: number,
      data:
        | FormData
        | Record<string, unknown>,
    ) => {
      const isFormData =
        typeof FormData !== "undefined" &&
        data instanceof FormData;

      /*
       * Laravel/PHP can have difficulty reading
       * multipart PUT requests.
       *
       * Therefore, when FormData is used:
       * POST + _method=PUT
       */
      if (isFormData) {
        if (!data.has("_method")) {
          data.append("_method", "PUT");
        }

        return api<
          Product | { data: Product }
        >(`/admin/products/${id}`, {
          method: "POST",
          body: data,
        }).then(unwrap);
      }

      return api<
        Product | { data: Product }
      >(`/admin/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }).then(unwrap);
    },

    delete: (id: number) =>
      api<ApiMessage>(
        `/admin/products/${id}`,
        {
          method: "DELETE",
        },
      ),
  },

  /*
  |--------------------------------------------------------------------------
  | Admin Categories
  |--------------------------------------------------------------------------
  |
  | Category images are now uploaded using FormData.
  |
  */

  categories: {
    /*
     * Get all categories.
     */
    list: () =>
      api<
        Category[] | {
          data: Category[];
        }
      >("/categories").then(unwrap),

    /*
     * Create category.
     *
     * Supports:
     * - FormData for category image upload
     * - Normal JSON data
     */
    create: (
      data:
        | FormData
        | Partial<Category>,
    ) => {
      const isFormData =
        typeof FormData !== "undefined" &&
        data instanceof FormData;

      return api<
        Category | {
          data: Category;
        }
      >("/categories", {
        method: "POST",
        body: isFormData
          ? data
          : JSON.stringify(data),
      }).then(unwrap);
    },

    /*
     * Update category.
     *
     * Supports:
     * - FormData for replacing category image
     * - Normal JSON update
     *
     * When FormData is used, Laravel receives:
     *
     * POST /categories/{id}
     * _method=PUT
     */
    update: (
      id: number,
      data:
        | FormData
        | Partial<Category>,
    ) => {
      const isFormData =
        typeof FormData !== "undefined" &&
        data instanceof FormData;

      if (isFormData) {
        /*
         * Laravel/PHP multipart PUT workaround.
         */
        if (!data.has("_method")) {
          data.append("_method", "PUT");
        }

        return api<
          Category | {
            data: Category;
          }
        >(`/categories/${id}`, {
          method: "POST",
          body: data,
        }).then(unwrap);
      }

      /*
       * Normal JSON update.
       */
      return api<
        Category | {
          data: Category;
        }
      >(`/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }).then(unwrap);
    },

    /*
     * Delete category.
     */
    delete: (id: number) =>
      api<ApiMessage>(
        `/categories/${id}`,
        {
          method: "DELETE",
        },
      ),
  },

  /*
  |--------------------------------------------------------------------------
  | Admin Orders
  |--------------------------------------------------------------------------
  */

  orders: {
    list: (
      page = 1,
      status?: string,
    ) =>
      api<PaginatedResponse<Order>>(
        `/orders${buildQuery({
          page,
          status,
        })}`,
      ),

    updateStatus: (
      id: number,
      status: string,
    ) =>
      api<
        Order | {
          data: Order;
        }
      >(`/orders/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status,
        }),
      }).then(unwrap),
  },

  /*
  |--------------------------------------------------------------------------
  | Admin Reviews
  |--------------------------------------------------------------------------
  */

  reviews: {
    list: (
      page = 1,
      status?: string,
    ) =>
      api<PaginatedResponse<Review>>(
        `/admin/reviews${buildQuery({
          page,
          status,
        })}`,
      ),

    moderate: (
      id: number,
      status: "approved" | "hidden",
    ) =>
      api<
        Review | {
          data: Review;
        }
      >(`/reviews/${id}/moderate`, {
        method: "PUT",
        body: JSON.stringify({
          status,
        }),
      }).then(unwrap),
  },
};