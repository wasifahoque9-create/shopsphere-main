"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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

declare global {
  interface Window {
    jQuery?: any;
  }
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function extractCategories(response: any): MainCategory[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  return [];
}

function getFirstValidationError(
  errors: Record<string, string[] | string> | undefined,
): string | null {
  if (!errors || typeof errors !== "object") {
    return null;
  }

  for (const value of Object.values(errors)) {
    if (Array.isArray(value) && value.length > 0) {
      return String(value[0]);
    }

    if (typeof value === "string") {
      return value;
    }
  }

  return null;
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

export default function ProductForm() {
  const router = useRouter();

  const [categories, setCategories] = useState<
    MainCategory[]
  >([]);

  const [categoriesLoading, setCategoriesLoading] =
    useState(true);

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] =
    useState("");
  const [stockQty, setStockQty] = useState("0");
  const [description, setDescription] =
    useState("");
  const [status, setStatus] = useState("active");

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] =
    useState<string[]>([]);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const descriptionRef =
    useRef<HTMLTextAreaElement | null>(null);

  const summernoteInitialized =
    useRef(false);

  /*
  |--------------------------------------------------------------------------
  | Initialize Summernote
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;

    const textarea = descriptionRef.current;

    if (!textarea) {
      return;
    }

    function initializeSummernote() {
      if (
        cancelled ||
        !descriptionRef.current ||
        !window.jQuery ||
        !window.jQuery.fn?.summernote ||
        summernoteInitialized.current
      ) {
        return;
      }

      const $ = window.jQuery;
      const currentTextarea = descriptionRef.current;

      $(currentTextarea).summernote({
        placeholder: "Enter product description",
        height: 300,
        minHeight: 200,
        maxHeight: 500,
        focus: false,

        toolbar: [
          ["style", ["style"]],
          [
            "font",
            ["bold", "italic", "underline", "clear"],
          ],
          ["fontname", ["fontname"]],
          ["fontsize", ["fontsize"]],
          ["color", ["color"]],
          ["para", ["ul", "ol", "paragraph"]],
          ["table", ["table"]],
          [
            "insert",
            ["link", "picture", "video"],
          ],
          [
            "view",
            ["fullscreen", "codeview", "help"],
          ],
        ],

        callbacks: {
          onChange: (contents: string) => {
            setDescription(contents);
          },
        },
      });

      /*
      |--------------------------------------------------------------------------
      | Make sure the editor starts empty
      |--------------------------------------------------------------------------
      */

      $(currentTextarea).summernote("code", "");

      summernoteInitialized.current = true;
    }

    /*
    |--------------------------------------------------------------------------
    | Load Summernote CSS
    |--------------------------------------------------------------------------
    */

    const summernoteCssId =
      "summernote-lite-css";

    if (!document.getElementById(summernoteCssId)) {
      const link = document.createElement("link");

      link.id = summernoteCssId;
      link.rel = "stylesheet";
      link.href =
        "https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/summernote-lite.min.css";

      document.head.appendChild(link);
    }

    /*
    |--------------------------------------------------------------------------
    | Load jQuery
    |--------------------------------------------------------------------------
    */

    const jqueryUrl =
      "https://code.jquery.com/jquery-3.7.1.min.js";

    const summernoteUrl =
      "https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/summernote-lite.min.js";

    function loadScript(
      id: string,
      src: string,
      onLoad: () => void,
    ) {
      const existingScript =
        document.getElementById(id) as HTMLScriptElement | null;

      if (existingScript) {
        if (
          existingScript.dataset.loaded === "true"
        ) {
          onLoad();
        } else {
          existingScript.addEventListener(
            "load",
            onLoad,
            { once: true },
          );
        }

        return;
      }

      const script =
        document.createElement("script");

      script.id = id;
      script.src = src;
      script.async = false;

      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
          onLoad();
        },
        { once: true },
      );

      document.body.appendChild(script);
    }

    function loadSummernote() {
      if (
        window.jQuery?.fn?.summernote
      ) {
        initializeSummernote();
        return;
      }

      loadScript(
        "summernote-js",
        summernoteUrl,
        initializeSummernote,
      );
    }

    if (window.jQuery) {
      loadSummernote();
    } else {
      loadScript(
        "jquery-js",
        jqueryUrl,
        loadSummernote,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Cleanup
    |--------------------------------------------------------------------------
    */

    return () => {
      cancelled = true;

      if (
        descriptionRef.current &&
        window.jQuery &&
        window.jQuery.fn?.summernote &&
        summernoteInitialized.current
      ) {
        try {
          window.jQuery(
            descriptionRef.current,
          ).summernote("destroy");
        } catch {
          // Ignore Summernote cleanup errors.
        }
      }

      summernoteInitialized.current = false;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Load main categories and subcategories
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadCategories() {
      setCategoriesLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE}/categories`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
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

        const categoryList =
          extractCategories(data);

        /*
        |--------------------------------------------------------------------------
        | Only keep main categories internally.
        |
        | The dropdown below will flatten their
        | subcategories and will NOT display the
        | main category names.
        |--------------------------------------------------------------------------
        */

        const mainCategories =
          categoryList.filter(
            (category) =>
              category.parent_id === null ||
              category.parent_id === undefined ||
              category.parent_id === 0,
          );

        setCategories(mainCategories);

        const hasSubcategories =
          mainCategories.some(
            (category) =>
              getSubcategories(category).length > 0,
          );

        if (mainCategories.length === 0) {
          setError(
            "No main categories are available. Please create a main category first.",
          );
        } else if (!hasSubcategories) {
          setError(
            "No subcategories are available. Please create a subcategory under a main category first.",
          );
        }
      } catch (categoryError) {
        if (
          categoryError instanceof DOMException &&
          categoryError.name === "AbortError"
        ) {
          return;
        }

        setError(
          categoryError instanceof Error
            ? categoryError.message
            : "Categories could not be loaded.",
        );
      } finally {
        setCategoriesLoading(false);
      }
    }

    void loadCategories();

    return () => {
      controller.abort();
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Generate image preview URLs
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const previewUrls = images.map((image) =>
      URL.createObjectURL(image),
    );

    setImagePreviews(previewUrls);

    return () => {
      previewUrls.forEach((previewUrl) => {
        URL.revokeObjectURL(previewUrl);
      });
    };
  }, [images]);

  /*
  |--------------------------------------------------------------------------
  | Select product images
  |--------------------------------------------------------------------------
  */

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(
      event.target.files ?? [],
    );

    if (selectedFiles.length === 0) {
      setImages([]);
      return;
    }

    if (selectedFiles.length > 8) {
      setError(
        "You may upload a maximum of 8 images.",
      );

      setImages([]);
      event.target.value = "";

      return;
    }

    const acceptedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    const invalidTypeFile =
      selectedFiles.find(
        (file) =>
          !acceptedTypes.includes(file.type),
      );

    if (invalidTypeFile) {
      setError(
        "Images must be JPG, JPEG, PNG, or WebP.",
      );

      setImages([]);
      event.target.value = "";

      return;
    }

    const maximumSize = 5 * 1024 * 1024;

    const oversizedFile =
      selectedFiles.find(
        (file) => file.size > maximumSize,
      );

    if (oversizedFile) {
      setError(
        "Each image must not be larger than 5 MB.",
      );

      setImages([]);
      event.target.value = "";

      return;
    }

    setError("");
    setImages(selectedFiles);
  }

  function removeImage(index: number) {
    setImages((currentImages) =>
      currentImages.filter(
        (_, imageIndex) =>
          imageIndex !== index,
      ),
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Check whether at least one subcategory exists
  |--------------------------------------------------------------------------
  */

  const hasSubcategories = categories.some(
    (category) =>
      getSubcategories(category).length > 0,
  );

  /*
  |--------------------------------------------------------------------------
  | Create product
  |--------------------------------------------------------------------------
  */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    if (!hasSubcategories) {
      setError(
        "Please create a main category and at least one subcategory before creating a product.",
      );

      return;
    }

    if (!categoryId) {
      setError(
        "Please select a product category.",
      );

      return;
    }

    if (images.length === 0) {
      setError(
        "Please select at least one product image.",
      );

      return;
    }

    const token =
      localStorage.getItem("token");

    if (!token) {
      setError(
        "You are not logged in. Please log in as an admin.",
      );

      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();

      /*
      |--------------------------------------------------------------------------
      | category_id MUST contain the subcategory ID.
      |--------------------------------------------------------------------------
      */

      formData.append(
        "category_id",
        categoryId,
      );

      formData.append(
        "name",
        name.trim(),
      );

      formData.append(
        "sku",
        sku.trim(),
      );

      formData.append(
        "brand",
        brand.trim(),
      );

      formData.append(
        "price",
        price,
      );

      if (discountPrice.trim() !== "") {
        formData.append(
          "discount_price",
          discountPrice,
        );
      }

      formData.append(
        "stock_qty",
        stockQty,
      );

      /*
      |--------------------------------------------------------------------------
      | Summernote stores the description as HTML.
      |--------------------------------------------------------------------------
      */

      formData.append(
        "description",
        description.trim(),
      );

      formData.append(
        "status",
        status,
      );

      images.forEach((image) => {
        formData.append(
          "images[]",
          image,
        );
      });

      const response = await fetch(
        `${API_BASE}/admin/products`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        const validationError =
          getFirstValidationError(
            data?.errors,
          );

        throw new Error(
          validationError ??
            data?.message ??
            "Product could not be created.",
        );
      }

      router.push("/admin/products");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Product could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/10";

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Product Category */}
        <div>
          <label
            htmlFor="category"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Product Category
          </label>

          <select
            id="category"
            value={categoryId}
            onChange={(event) =>
              setCategoryId(
                event.target.value,
              )
            }
            required
            disabled={
              categoriesLoading ||
              !hasSubcategories
            }
            className={`${inputClass} bg-white disabled:cursor-not-allowed disabled:bg-gray-100`}
          >
            <option value="">
              {categoriesLoading
                ? "Loading categories..."
                : !hasSubcategories
                  ? "No subcategories available"
                  : "Select Shop by Category"}
            </option>

            {/*
            |--------------------------------------------------------------------------
            | IMPORTANT:
            | Only subcategories are rendered here.
            |
            | There is NO <optgroup>, so main category
            | names will not appear in the dropdown.
            |--------------------------------------------------------------------------
            */}

            {categories.flatMap(
              (mainCategory) =>
                getSubcategories(
                  mainCategory,
                ).map((subcategory) => (
                  <option
                    key={subcategory.id}
                    value={subcategory.id}
                  >
                    {subcategory.name}
                  </option>
                )),
            )}
          </select>
        </div>

        {/* Product Name */}
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Product name
          </label>

          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            required
            placeholder="Enter product name"
            className={inputClass}
          />
        </div>

        {/* SKU */}
        <div>
          <label
            htmlFor="sku"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            SKU
          </label>

          <input
            id="sku"
            type="text"
            value={sku}
            onChange={(event) =>
              setSku(event.target.value)
            }
            required
            placeholder="SKU-001"
            className={inputClass}
          />
        </div>

        {/* Brand */}
        <div>
          <label
            htmlFor="brand"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Brand
          </label>

          <input
            id="brand"
            type="text"
            value={brand}
            onChange={(event) =>
              setBrand(event.target.value)
            }
            placeholder="Enter brand"
            className={inputClass}
          />
        </div>

        {/* Price */}
        <div>
          <label
            htmlFor="price"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Price
          </label>

          <input
            id="price"
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(event) =>
              setPrice(event.target.value)
            }
            required
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        {/* Discount Price */}
        <div>
          <label
            htmlFor="discount_price"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Discount Price
          </label>

          <input
            id="discount_price"
            type="number"
            min="0"
            step="0.01"
            value={discountPrice}
            onChange={(event) =>
              setDiscountPrice(
                event.target.value,
              )
            }
            placeholder="Leave empty if there is no discount"
            className={inputClass}
          />
        </div>

        {/* Stock */}
        <div>
          <label
            htmlFor="stock"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Stock quantity
          </label>

          <input
            id="stock"
            type="number"
            min="0"
            step="1"
            value={stockQty}
            onChange={(event) =>
              setStockQty(
                event.target.value,
              )
            }
            required
            placeholder="0"
            className={inputClass}
          />
        </div>

        {/* Status */}
        <div>
          <label
            htmlFor="status"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Status
          </label>

          <select
            id="status"
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value,
              )
            }
            className={`${inputClass} bg-white`}
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

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="mb-2 block text-sm font-semibold text-gray-700"
        >
          Description
        </label>

        <textarea
          ref={descriptionRef}
          id="description"
          defaultValue=""
          required
          placeholder="Enter product description"
          className="w-full"
        />
      </div>

      {/* Product image section */}
      <div>
        <label
          htmlFor="images"
          className="mb-2 block text-sm font-semibold text-gray-700"
        >
          Product images
        </label>

        <input
          id="images"
          name="images"
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          multiple
          onChange={handleImageChange}
          className="block w-full cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#121358] file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-[#1d1e75]"
        />

        <p className="mt-2 text-xs text-gray-500">
          Select JPG, JPEG, PNG, or WebP files.
          Maximum 8 images and 5 MB per image.
          The first image will be the primary
          image.
        </p>

        {imagePreviews.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {imagePreviews.map(
              (previewUrl, index) => (
                <div
                  key={previewUrl}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={`Product preview ${
                      index + 1
                    }`}
                    className="h-36 w-full object-cover"
                  />

                  <div className="p-3">
                    {index === 0 && (
                      <p className="mb-1 text-xs font-semibold text-green-700">
                        Primary image
                      </p>
                    )}

                    <p className="truncate text-xs text-gray-600">
                      {images[index]?.name}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        removeImage(index)
                      }
                      className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/admin/products",
            )
          }
          className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={
            submitting ||
            categoriesLoading ||
            !hasSubcategories
          }
          className="rounded-xl bg-[#121358] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1d1e75] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? "Creating product..."
            : "Create Product"}
        </button>
      </div>
    </form>
  );
}