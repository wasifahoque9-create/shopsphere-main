"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";

import { PageLoader } from "@/components/ui/Spinner";
import { API_BASE } from "@/lib/api";

type Subcategory = {
  id: number;
  name: string;
  slug?: string;
  parent_id?: number | null;
};

type MainCategory = {
  id: number;
  name: string;
  slug?: string;
  parent_id?: number | null;
  subcategories?: Subcategory[];
  children?: Subcategory[];
};

type ProductImagePreview = {
  id?: number;
  image_path?: string | null;
  url?: string | null;
  is_primary?: boolean;
};

type EditProductForm = {
  category_id: string;
  name: string;
  slug: string;
  sku: string;
  brand: string;
  price: string;
  discount_price: string;
  stock_qty: string;
  status: string;
  description: string;
};

const initialForm: EditProductForm = {
  category_id: "",
  name: "",
  slug: "",
  sku: "",
  brand: "",
  price: "",
  discount_price: "",
  stock_qty: "",
  status: "active",
  description: "",
};

declare global {
  interface Window {
    jQuery?: any;
  }
}

function makeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/*
|--------------------------------------------------------------------------
| Prepare Summernote HTML
|--------------------------------------------------------------------------
|
| Summernote correctly saves <ul>, <ol> and <li>.
|
| The problem is that Tailwind's preflight/browser styles can remove the
| visible list markers.
|
| Instead of using normal CSS or Tailwind arbitrary selectors, we add
| Tailwind utility classes directly to the generated HTML.
|
*/
function prepareSummernoteHtml(html: string): string {
  let result = html;

  /*
  |--------------------------------------------------------------------------
  | Unordered lists
  |--------------------------------------------------------------------------
  */

  result = result.replace(
    /<ul\b([^>]*)>/gi,
    (_match, attributes: string) => {
      const hasClass =
        /\bclass\s*=\s*["'][^"']*["']/i.test(
          attributes,
        );

      if (hasClass) {
        return `<ul${attributes.replace(
          /\bclass\s*=\s*(["'])(.*?)\1/i,
          (
            _classMatch,
            quote: string,
            classNames: string,
          ) =>
            `class=${quote}${classNames} list-disc pl-6 my-4${quote}`,
        )}>`;
      }

      return `<ul class="list-disc pl-6 my-4"${attributes}>`;
    },
  );

  /*
  |--------------------------------------------------------------------------
  | Ordered lists
  |--------------------------------------------------------------------------
  */

  result = result.replace(
    /<ol\b([^>]*)>/gi,
    (_match, attributes: string) => {
      const hasClass =
        /\bclass\s*=\s*["'][^"']*["']/i.test(
          attributes,
        );

      if (hasClass) {
        return `<ol${attributes.replace(
          /\bclass\s*=\s*(["'])(.*?)\1/i,
          (
            _classMatch,
            quote: string,
            classNames: string,
          ) =>
            `class=${quote}${classNames} list-decimal pl-6 my-4${quote}`,
        )}>`;
      }

      return `<ol class="list-decimal pl-6 my-4"${attributes}>`;
    },
  );

  /*
  |--------------------------------------------------------------------------
  | List items
  |--------------------------------------------------------------------------
  */

  result = result.replace(
    /<li\b([^>]*)>/gi,
    (_match, attributes: string) => {
      const hasClass =
        /\bclass\s*=\s*["'][^"']*["']/i.test(
          attributes,
        );

      if (hasClass) {
        return `<li${attributes.replace(
          /\bclass\s*=\s*(["'])(.*?)\1/i,
          (
            _classMatch,
            quote: string,
            classNames: string,
          ) =>
            `class=${quote}${classNames} my-1${quote}`,
        )}>`;
      }

      return `<li class="my-1"${attributes}>`;
    },
  );

  return result;
}

function getToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const tokenKeys = [
    "auth_token",
    "token",
    "access_token",
    "admin_token",
    "shopsphere_token",
  ];

  for (const key of tokenKeys) {
    const token = localStorage.getItem(key);

    if (token) {
      return token.replace(/^Bearer\s+/i, "");
    }
  }

  return "";
}

function getHeaders(includeJson = true): HeadersInit {
  const token = getToken();

  const requestHeaders: HeadersInit = {
    Accept: "application/json",
  };

  if (includeJson) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  return requestHeaders;
}

function unwrapResponse(response: any): any {
  return (
    response?.data?.data ??
    response?.data ??
    response?.product ??
    response
  );
}

function extractCategoryList(
  response: any,
): MainCategory[] {
  const data =
    response?.data?.data ??
    response?.data ??
    response;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.categories)) {
    return data.categories;
  }

  return [];
}

function normalizeCategories(
  categories: MainCategory[],
): MainCategory[] {
  return categories.filter(
    (category) =>
      category &&
      Number(category.id) > 0 &&
      Number(category.parent_id ?? 0) === 0,
  );
}

function getSubcategories(
  category: MainCategory,
): Subcategory[] {
  if (Array.isArray(category.subcategories)) {
    return category.subcategories;
  }

  if (Array.isArray(category.children)) {
    return category.children;
  }

  return [];
}

async function fetchProduct(
  id: number,
): Promise<any> {
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Invalid product ID.");
  }

  const response = await fetch(
    `${API_BASE}/admin/products/${id}`,
    {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: getHeaders(false),
    },
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        "Product could not be loaded.",
    );
  }

  const product = unwrapResponse(data);

  if (!product?.id) {
    throw new Error(
      "Product could not be loaded.",
    );
  }

  return product;
}

async function fetchCategories(): Promise<
  MainCategory[]
> {
  const response = await fetch(
    `${API_BASE}/categories`,
    {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        "Categories could not be loaded.",
    );
  }

  return normalizeCategories(
    extractCategoryList(data),
  );
}

function imageUrl(
  image: ProductImagePreview,
): string {
  const url =
    image.url ||
    image.image_path ||
    "";

  if (!url) {
    return "/placeholder-product.svg";
  }

  if (/^https?:\/\//i.test(url)) {
    return url.replace(
      /^http:\/\//i,
      "https://",
    );
  }

  const storageBase =
    process.env.NEXT_PUBLIC_STORAGE_URL ||
    `${API_BASE.replace(
      /\/api\/?$/,
      "",
    )}/storage`;

  return `${storageBase}/${url
    .replace(/^\/+/, "")
    .replace(/^storage\//, "")}`;
}

function productImages(
  product: any,
): ProductImagePreview[] {
  const images =
    product?.images ??
    product?.product_images ??
    [];

  if (
    Array.isArray(images) &&
    images.length > 0
  ) {
    return images;
  }

  const primary =
    product?.primary_image ??
    product?.primaryImage ??
    product?.image ??
    product?.thumbnail ??
    "";

  if (!primary) {
    return [];
  }

  if (typeof primary === "string") {
    return [
      {
        url: primary,
        image_path: primary,
        is_primary: true,
      },
    ];
  }

  return [primary];
}

async function updateProduct(
  id: number,
  body: Record<string, unknown>,
  files: File[],
): Promise<any> {
  if (files.length > 0) {
    const formData = new FormData();

    formData.append("_method", "PUT");

    Object.entries(body).forEach(
      ([key, value]) => {
        formData.append(
          key,
          value === null ||
            value === undefined
            ? ""
            : String(value),
        );
      },
    );

    files.forEach((file) => {
      formData.append(
        "images[]",
        file,
      );
    });

    const response = await fetch(
      `${API_BASE}/admin/products/${id}`,
      {
        method: "POST",
        credentials: "include",
        headers: getHeaders(false),
        body: formData,
      },
    );

    const data = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.message ??
          "Product could not be updated.",
      );
    }

    return data;
  }

  const response = await fetch(
    `${API_BASE}/admin/products/${id}`,
    {
      method: "PUT",
      credentials: "include",
      headers: getHeaders(true),
      body: JSON.stringify(body),
    },
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ??
        "Product could not be updated.",
    );
  }

  return data;
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = params?.id;

  const productId = Number(
    Array.isArray(rawId)
      ? rawId[0]
      : rawId,
  );

  const [categories, setCategories] =
    useState<MainCategory[]>([]);

  const [form, setForm] =
    useState<EditProductForm>(
      initialForm,
    );

  const [currentImages, setCurrentImages] =
    useState<ProductImagePreview[]>(
      [],
    );

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const [selectedPreviews, setSelectedPreviews] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const descriptionRef =
    useRef<HTMLTextAreaElement | null>(
      null,
    );

  const summernoteInitialized =
    useRef(false);

  /*
  |--------------------------------------------------------------------------
  | Load product + categories
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (
        !Number.isFinite(productId) ||
        productId <= 0
      ) {
        setError(
          "Invalid product ID.",
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [
          product,
          categoryList,
        ] = await Promise.all([
          fetchProduct(productId),
          fetchCategories(),
        ]);

        if (cancelled) {
          return;
        }

        const categoryId =
          product?.category_id ??
          product?.category?.id ??
          "";

        const description =
          product?.description ?? "";

        setCategories(categoryList);

        setForm({
          category_id: categoryId
            ? String(categoryId)
            : "",

          name:
            product?.name ?? "",

          slug:
            product?.slug ?? "",

          sku:
            product?.sku ?? "",

          brand:
            product?.brand ?? "",

          price:
            product?.price !== null &&
            product?.price !== undefined
              ? String(product.price)
              : "",

          discount_price:
            product?.discount_price !== null &&
            product?.discount_price !== undefined
              ? String(
                  product.discount_price,
                )
              : "",

          stock_qty:
            product?.stock_qty !== null &&
            product?.stock_qty !== undefined
              ? String(
                  product.stock_qty,
                )
              : "0",

          status:
            product?.status ??
            "active",

          description,
        });

        setCurrentImages(
          productImages(product),
        );
      } catch (loadError) {
        console.error(
          "Unable to load product:",
          loadError,
        );

        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Product could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  /*
  |--------------------------------------------------------------------------
  | Initialize Summernote
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      loading ||
      !descriptionRef.current ||
      summernoteInitialized.current
    ) {
      return;
    }

    let cancelled = false;

    async function initializeSummernote() {
      try {
        /*
        |--------------------------------------------------------------------------
        | Load Summernote stylesheet
        |--------------------------------------------------------------------------
        */

        const loadStylesheet = (
          href: string,
        ) => {
          if (
            document.querySelector(
              `link[href="${href}"]`,
            )
          ) {
            return;
          }

          const link =
            document.createElement(
              "link",
            );

          link.rel = "stylesheet";
          link.href = href;

          document.head.appendChild(
            link,
          );
        };

        /*
        |--------------------------------------------------------------------------
        | Load JavaScript
        |--------------------------------------------------------------------------
        */

        const loadScript = (
          src: string,
        ): Promise<void> => {
          return new Promise(
            (
              resolve,
              reject,
            ) => {
              const existingScript =
                document.querySelector(
                  `script[src="${src}"]`,
                ) as HTMLScriptElement | null;

              if (existingScript) {
                if (
                  window.jQuery?.fn
                    ?.summernote
                ) {
                  resolve();
                  return;
                }

                existingScript.addEventListener(
                  "load",
                  () => resolve(),
                  {
                    once: true,
                  },
                );

                existingScript.addEventListener(
                  "error",
                  () =>
                    reject(
                      new Error(
                        `Failed to load ${src}`,
                      ),
                    ),
                  {
                    once: true,
                  },
                );

                return;
              }

              const script =
                document.createElement(
                  "script",
                );

              script.src = src;
              script.async = false;

              script.onload = () =>
                resolve();

              script.onerror = () =>
                reject(
                  new Error(
                    `Failed to load ${src}`,
                  ),
                );

              document.body.appendChild(
                script,
              );
            },
          );
        };

        loadStylesheet(
          "https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/summernote-lite.min.css",
        );

        /*
        |--------------------------------------------------------------------------
        | jQuery
        |--------------------------------------------------------------------------
        */

        if (!window.jQuery) {
          await loadScript(
            "https://code.jquery.com/jquery-3.7.1.min.js",
          );
        }

        /*
        |--------------------------------------------------------------------------
        | Summernote
        |--------------------------------------------------------------------------
        */

        if (
          !window.jQuery?.fn?.summernote
        ) {
          await loadScript(
            "https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/summernote-lite.min.js",
          );
        }

        if (
          cancelled ||
          !descriptionRef.current ||
          !window.jQuery?.fn
            ?.summernote
        ) {
          return;
        }

        const $ =
          window.jQuery;

        const textarea =
          descriptionRef.current;

        /*
        |--------------------------------------------------------------------------
        | Initialize Summernote
        |--------------------------------------------------------------------------
        */

        $(textarea).summernote({
          placeholder:
            "Enter product description",

          height: 300,

          minHeight: 200,

          maxHeight: 500,

          focus: false,

          /*
          |--------------------------------------------------------------------------
          | Formatting styles
          |--------------------------------------------------------------------------
          */

          styleTags: [
            "p",
            "blockquote",
            "pre",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
          ],

          /*
          |--------------------------------------------------------------------------
          | Toolbar
          |--------------------------------------------------------------------------
          */

          toolbar: [
            [
              "style",
              ["style"],
            ],

            [
              "font",
              [
                "bold",
                "italic",
                "underline",
                "clear",
              ],
            ],

            [
              "fontname",
              ["fontname"],
            ],

            [
              "fontsize",
              ["fontsize"],
            ],

            [
              "color",
              ["color"],
            ],

            /*
            |--------------------------------------------------------------------------
            | IMPORTANT:
            | ul = unordered/bullet list
            | ol = ordered/numbered list
            |--------------------------------------------------------------------------
            */

            [
              "para",
              [
                "ul",
                "ol",
                "paragraph",
              ],
            ],

            [
              "table",
              ["table"],
            ],

            [
              "insert",
              [
                "link",
                "picture",
                "video",
              ],
            ],

            [
              "view",
              [
                "fullscreen",
                "codeview",
                "help",
              ],
            ],
          ],

          /*
          |--------------------------------------------------------------------------
          | Summernote callbacks
          |--------------------------------------------------------------------------
          */

          callbacks: {
            onChange: (
              contents: string,
            ) => {
              setForm(
                (current) => ({
                  ...current,
                  description:
                    contents,
                }),
              );
            },
          },
        });

        /*
        |--------------------------------------------------------------------------
        | Load the saved product description
        |--------------------------------------------------------------------------
        |
        | We explicitly put the existing description into Summernote.
        |
        */

        $(textarea).summernote(
          "code",
          form.description,
        );

        summernoteInitialized.current =
          true;
      } catch (
        summernoteError
      ) {
        console.error(
          "Summernote initialization failed:",
          summernoteError,
        );
      }
    }

    void initializeSummernote();

    /*
    |--------------------------------------------------------------------------
    | Cleanup Summernote
    |--------------------------------------------------------------------------
    */

    return () => {
      cancelled = true;

      if (
        descriptionRef.current &&
        window.jQuery?.fn
          ?.summernote
      ) {
        const $ =
          window.jQuery;

        try {
          if (
            $(descriptionRef.current).next(
              ".note-editor",
            ).length
          ) {
            $(descriptionRef.current).summernote(
              "destroy",
            );
          }
        } catch (
          destroyError
        ) {
          console.error(
            "Summernote cleanup failed:",
            destroyError,
          );
        }
      }

      summernoteInitialized.current =
        false;
    };
  }, [loading]);

  /*
  |--------------------------------------------------------------------------
  | Revoke selected image preview URLs
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    return () => {
      selectedPreviews.forEach(
        (url) => {
          URL.revokeObjectURL(
            url,
          );
        },
      );
    };
  }, [selectedPreviews]);

  function updateForm(
    field: keyof EditProductForm,
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Image selection
  |--------------------------------------------------------------------------
  */

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(
      event.target.files ?? [],
    );

    if (files.length > 8) {
      setError(
        "You may upload a maximum of 8 images.",
      );

      event.target.value = "";

      return;
    }

    const acceptedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    const invalidFile =
      files.find(
        (file) =>
          !acceptedTypes.includes(
            file.type,
          ),
      );

    if (invalidFile) {
      setError(
        "Images must be JPG, JPEG, or WebP.",
      );

      event.target.value = "";

      return;
    }

    const oversizedFile =
  files.find(
    (file) =>
      file.size >
      5 * 1024 * 1024,
     );

    if (oversizedFile) {
      setError(
        "Each image must not be larger than 5 MB.",
      );

      event.target.value = "";

      return;
    }

    selectedPreviews.forEach(
      (url) => {
        URL.revokeObjectURL(
          url,
        );
      },
    );

    setError("");

    setSelectedFiles(files);

    setSelectedPreviews(
      files.map((file) =>
        URL.createObjectURL(
          file,
        ),
      ),
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Submit product update
  |--------------------------------------------------------------------------
  */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT:
    | Get the latest HTML directly from Summernote before saving.
    |--------------------------------------------------------------------------
    */

    let latestDescription =
      form.description;

    if (
      descriptionRef.current &&
      window.jQuery?.fn
        ?.summernote
    ) {
      latestDescription =
        window.jQuery(
          descriptionRef.current,
        ).summernote(
          "code",
        );

      setForm(
        (current) => ({
          ...current,
          description:
            latestDescription,
        }),
      );
    }

    if (!form.category_id) {
      setError(
        "Please select a product category.",
      );

      return;
    }

    if (!form.name.trim()) {
      setError(
        "Please enter a product name.",
      );

      return;
    }

    try {
      setSaving(true);

      const body = {
        category_id: Number(
          form.category_id,
        ),

        name:
          form.name.trim(),

        slug:
          form.slug.trim() ||
          makeSlug(form.name),

        sku:
          form.sku.trim(),

        brand:
          form.brand.trim(),

        price:
          Number(form.price),

        discount_price:
          form.discount_price.trim()
            ? Number(
                form.discount_price,
              )
            : null,

        stock_qty:
          Number(
            form.stock_qty,
          ),

        status:
          form.status,

        /*
        |--------------------------------------------------------------------------
        | Save the original Summernote HTML.
        |--------------------------------------------------------------------------
        |
        | We DO NOT modify the HTML before sending it to Laravel.
        | Therefore <ul>, <ol>, <li>, formatting, etc. remain stored.
        |
        */

        description:
          latestDescription,
      };

      await updateProduct(
        productId,
        body,
        selectedFiles,
      );

      router.push(
        "/admin/products",
      );

      router.refresh();
    } catch (
      submitError
    ) {
      console.error(
        "Product update failed:",
        submitError,
      );

      setError(
        submitError instanceof Error
          ? submitError.message
          : "Product could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  const subcategories =
    categories.flatMap(
      (mainCategory) =>
        getSubcategories(
          mainCategory,
        ),
    );

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-black text-[#121358]">
            Edit Product
          </h1>

          <Link
            href="/admin/products"
            className="inline-flex items-center justify-center rounded-xl bg-[#121358] px-5 py-3 text-sm font-bold text-white"
          >
            Back to Products
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {/* Category */}

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Product Category
              </label>

              <select
                value={
                  form.category_id
                }
                onChange={(event) =>
                  updateForm(
                    "category_id",
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/20"
                required
              >
                <option value="">
                  Select Shop by Category
                </option>

                {subcategories.map(
                  (
                    subcategory,
                  ) => (
                    <option
                      key={
                        subcategory.id
                      }
                      value={
                        subcategory.id
                      }
                    >
                      {
                        subcategory.name
                      }
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* Product name */}

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Product name
              </label>

              <input
                value={
                  form.name
                }
                onChange={(event) =>
                  updateForm(
                    "name",
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/20"
                required
              />
            </div>

            {/* SKU */}

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                SKU
              </label>

              <input
                value={
                  form.sku
                }
                onChange={(event) =>
                  updateForm(
                    "sku",
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/20"
                required
              />
            </div>

            {/* Brand */}

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Brand
              </label>

              <input
                value={
                  form.brand
                }
                onChange={(event) =>
                  updateForm(
                    "brand",
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/20"
              />
            </div>

            {/* Price */}

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Price
              </label>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={
                  form.price
                }
                onChange={(event) =>
                  updateForm(
                    "price",
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/20"
                required
              />
            </div>

            {/* Discount */}

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Discount price
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.discount_price
                }
                onChange={(event) =>
                  updateForm(
                    "discount_price",
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/20"
                placeholder="Optional"
              />
            </div>

            {/* Stock */}

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Stock quantity
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={
                  form.stock_qty
                }
                onChange={(event) =>
                  updateForm(
                    "stock_qty",
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/20"
                required
              />
            </div>

            {/* Status */}

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Status
              </label>

              <select
                value={
                  form.status
                }
                onChange={(event) =>
                  updateForm(
                    "status",
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/20"
              >
                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>

                <option value="draft">
                  Draft
                </option>
              </select>
            </div>
          </div>

          {/* ============================================================
              DESCRIPTION / SUMMERNOTE
              ============================================================ */}

          <div className="mt-5">
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Description
            </label>

            <textarea
              ref={
                descriptionRef
              }
              defaultValue={
                form.description
              }
              onChange={(event) =>
                updateForm(
                  "description",
                  event.target.value,
                )
              }
              className="min-h-36 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/20"
              required
            />
          </div>

          {/* Current images */}

          <div className="mt-6">
            <p className="mb-3 text-sm font-bold text-slate-700">
              Current images
            </p>

            {currentImages.length >
            0 ? (
              <div className="flex flex-wrap gap-4">
                {currentImages.map(
                  (
                    image,
                    index,
                  ) => (
                    <div
                      key={
                        image.id ??
                        index
                      }
                    >
                      <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <img
                          src={imageUrl(
                            image,
                          )}
                          alt={
                            form.name ||
                            "Product"
                          }
                          className="h-full w-full object-contain p-2"
                          onError={(
                            event,
                          ) => {
                            event.currentTarget.src =
                              "/placeholder-product.svg";
                          }}
                        />
                      </div>

                      {image.is_primary && (
                        <p className="mt-2 text-xs font-bold text-green-600">
                          Primary image
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-slate-200 text-sm font-bold text-slate-500">
                Product
              </div>
            )}
          </div>

          {/* Replace images */}

          <div className="mt-6">
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Replace product images
            </label>

            <label className="flex w-full cursor-pointer flex-col gap-3 rounded-xl border border-slate-300 bg-white p-3 text-sm sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={
                  handleFileChange
                }
                className="hidden"
              />

              <span className="inline-flex w-fit items-center justify-center rounded-lg bg-[#121358] px-5 py-3 text-sm font-black text-white">
                Choose Files
              </span>

              <span className="text-sm font-semibold text-slate-500">
                {selectedFiles.length >
                0
                  ? `${selectedFiles.length} file(s) selected`
                  : "No file chosen"}
              </span>
            </label>

            <p className="mt-2 text-xs text-slate-500">
              Maximum 8 images and
              5 MB per image.
            </p>

            {selectedPreviews.length >
              0 && (
              <div className="mt-4 flex flex-wrap gap-4">
                {selectedPreviews.map(
                  (
                    preview,
                    index,
                  ) => (
                    <div
                      key={
                        preview
                      }
                    >
                      <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <img
                          src={
                            preview
                          }
                          alt={`Selected image ${
                            index +
                            1
                          }`}
                          className="h-full w-full object-contain p-2"
                        />
                      </div>

                      {index ===
                        0 && (
                        <p className="mt-2 text-xs font-bold text-green-600">
                          New primary
                          image
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Buttons */}

          <div className="mt-8 flex justify-end gap-3 border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/admin/products",
                )
              }
              className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-600"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#121358] px-7 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}