
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import AIInventoryAssistant from "./components/AIInventoryAssistant";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const emptyProduct = { name: "", category: "", price: "", quantity: "" };
const emptySale = { productId: "", quantity: "1" };

const formatPrice = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

function getStockStatus(quantity) {
  const stock = Number(quantity) || 0;

  if (stock <= 0) return { label: "Out of Stock", className: "stock-critical" };
  if (stock < 10) return { label: "Critical", className: "stock-critical" };
  if (stock <= 15) return { label: "Low Stock", className: "stock-low" };

  return { label: "In Stock", className: "stock-good" };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Request failed (${response.status})`);
  }

  return result;
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [saleForm, setSaleForm] = useState(emptySale);
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(emptyProduct);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: "", text: "" });

  const showNotice = (type, text) => setNotice({ type, text });

  async function loadProducts() {
    const result = await apiRequest("/api/products");
    setProducts(Array.isArray(result.data) ? result.data : []);
  }

  async function loadSales() {
    const result = await apiRequest("/api/sales");
    setSales(Array.isArray(result.data) ? result.data : []);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([loadProducts(), loadSales()]);
    } catch (error) {
      showNotice("error", error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((p) => {
      const matchesSearch =
        String(p.name || "").toLowerCase().includes(query) ||
        String(p.category || "").toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "All Categories" ||
        p.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const todaySales = sales.filter((sale) => {
    if (!sale.createdAt) return false;
    const date = new Date(sale.createdAt);
    return !Number.isNaN(date.getTime()) &&
      date.toDateString() === new Date().toDateString();
  });

  const stats = {
    productTypes: products.length,
    totalUnits: products.reduce(
      (sum, p) => sum + Math.max(0, Number(p.quantity) || 0),
      0
    ),
    inventoryValue: products.reduce(
      (sum, p) => sum + (Number(p.price) || 0) * (Number(p.quantity) || 0),
      0
    ),
    needsAttention: products.filter((p) => Number(p.quantity) <= 15).length,
    todayRevenue: todaySales.reduce(
      (sum, sale) => sum + (Number(sale.total) || 0),
      0
    ),
    todayTransactions: todaySales.length,
  };

  const selectedProduct = products.find((p) => p._id === saleForm.productId);
  const saleQuantity = Number(saleForm.quantity);
  const saleTotal = (Number(selectedProduct?.price) || 0) * saleQuantity;

  function updateForm(setter, event) {
    const { name, value } = event.target;
    setter((current) => ({ ...current, [name]: value }));
  }

  function validateProduct(form) {
    if (!form.name.trim() || !form.category.trim()) {
      showNotice("error", "Enter the product name and category.");
      return false;
    }

    if (form.price === "" || !Number.isFinite(Number(form.price)) ||
        Number(form.price) < 0) {
      showNotice("error", "Enter a valid product price.");
      return false;
    }

    if (form.quantity === "" || !Number.isInteger(Number(form.quantity)) ||
        Number(form.quantity) < 0) {
      showNotice("error", "Stock must be a whole number of zero or more.");
      return false;
    }

    return true;
  }

  function productData(form) {
    return {
      name: form.name.trim(),
      category: form.category.trim(),
      price: Number(form.price),
      quantity: Number(form.quantity),
    };
  }

  async function handleAddProduct(event) {
    event.preventDefault();
    if (!validateProduct(productForm)) return;

    setSaving(true);
    try {
      const result = await apiRequest("/api/products", {
        method: "POST",
        body: JSON.stringify(productData(productForm)),
      });
      await loadProducts();
      setProductForm(emptyProduct);
      setPage("inventory");
      showNotice("success", result.message || "Product added successfully.");
    } catch (error) {
      showNotice("error", error.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditing(product) {
    setEditingId(product._id);
    setEditingForm({
      name: product.name || "",
      category: product.category || "",
      price: String(product.price ?? ""),
      quantity: String(product.quantity ?? ""),
    });
    setNotice({ type: "", text: "" });
  }

  async function saveEditing(id) {
    if (!validateProduct(editingForm)) return;

    setSaving(true);
    try {
      const result = await apiRequest(`/api/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(productData(editingForm)),
      });
      await loadProducts();
      setEditingId(null);
      showNotice("success", result.message || "Product updated successfully.");
    } catch (error) {
      showNotice("error", error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const result = await apiRequest(`/api/products/${product._id}`, {
        method: "DELETE",
      });
      await loadProducts();
      showNotice("success", result.message || "Product deleted successfully.");
    } catch (error) {
      showNotice("error", error.message);
    }
  }

  async function handleRecordSale(event) {
    event.preventDefault();

    if (!selectedProduct) {
      showNotice("error", "Please select a product.");
      return;
    }

    if (!Number.isInteger(saleQuantity) || saleQuantity < 1) {
      showNotice("error", "Quantity must be a whole number greater than zero.");
      return;
    }

    if (saleQuantity > Number(selectedProduct.quantity)) {
      showNotice("error", "The requested quantity exceeds available stock.");
      return;
    }

    setSaving(true);
    try {
      const result = await apiRequest("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          productId: saleForm.productId,
          quantity: saleQuantity,
        }),
      });
      setSaleForm(emptySale);
      await Promise.all([loadProducts(), loadSales()]);
      showNotice("success", result.message || "Sale recorded successfully.");
    } catch (error) {
      showNotice("error", error.message);
    } finally {
      setSaving(false);
    }
  }

  function renderProductFields(form, setter) {
    return (
      <>
        <label>
          Product Name
          <input name="name" value={form.name} onChange={(e) => updateForm(setter, e)}
            placeholder="e.g. Motorcycle Oil Filter" maxLength={100} required />
        </label>
        <label>
          Category
          <input name="category" value={form.category} onChange={(e) => updateForm(setter, e)}
            placeholder="e.g. Engine Parts" maxLength={60} required />
        </label>
        <label>
          Selling Price (₱)
          <input name="price" type="number" min="0" step="0.01" value={form.price}
            onChange={(e) => updateForm(setter, e)} required />
        </label>
        <label>
          Stock Quantity
          <input name="quantity" type="number" min="0" step="1" value={form.quantity}
            onChange={(e) => updateForm(setter, e)} required />
        </label>
      </>
    );
  }

  function renderProductTable(items, editable = false) {
    if (loading) return <div className="empty-state">Loading inventory...</div>;

    if (!items.length) {
      return (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <strong>No products found</strong>
          <p>Try another search or add a spare part to your inventory.</p>
        </div>
      );
    }

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Spare Part</th><th>Category</th><th>Price</th>
              <th>Stock</th><th>Status</th>{editable && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((product) => {
              const editing = editingId === product._id;
              const status = getStockStatus(product.quantity);

              return (
                <tr key={product._id}>
                  <td>
                    {editing ? (
                      <input name="name" value={editingForm.name}
                        onChange={(e) => updateForm(setEditingForm, e)} />
                    ) : <strong>{product.name}</strong>}
                  </td>
                  <td>
                    {editing ? (
                      <input name="category" value={editingForm.category}
                        onChange={(e) => updateForm(setEditingForm, e)} />
                    ) : product.category}
                  </td>
                  <td>
                    {editing ? (
                      <input name="price" type="number" min="0" step="0.01"
                        value={editingForm.price}
                        onChange={(e) => updateForm(setEditingForm, e)} />
                    ) : formatPrice(product.price)}
                  </td>
                  <td>
                    {editing ? (
                      <input name="quantity" type="number" min="0" step="1"
                        value={editingForm.quantity}
                        onChange={(e) => updateForm(setEditingForm, e)} />
                    ) : <strong>{product.quantity}</strong>}
                  </td>
                  <td>
                    {!editing && (
                      <span className={`stock-badge ${status.className}`}>
                        <span className="status-dot" />{status.label}
                      </span>
                    )}
                  </td>
                  {editable && (
                    <td>
                      <div className="action-group">
                        {editing ? (
                          <>
                            <button className="btn btn-small btn-primary"
                              onClick={() => saveEditing(product._id)} disabled={saving}>
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button className="btn btn-small btn-ghost"
                              onClick={() => setEditingId(null)} disabled={saving}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-small btn-ghost"
                              onClick={() => startEditing(product)}>Edit</button>
                            <button className="btn btn-small btn-danger-ghost"
                              onClick={() => deleteProduct(product)}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const pageTitle = {
    dashboard: "Dashboard",
    inventory: "Spare Parts",
    add: "Add Product",
    sales: "Sales",
  }[page];

  function goTo(nextPage) {
    setNotice({ type: "", text: "" });
    setPage(nextPage);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">

        
        <div className="brand">
          <div className="brand-icon">
            <img
              src="/motorpartslogo.jpg"
              alt="MotorParts Logo"
            />
          </div>

          <div className="brand-text">
            <strong>MotorParts</strong>
            <span>Inventory System</span>
          </div>
        </div>




        <div className="nav-label">WORKSPACE</div>
        <nav className="navigation">
          {[
            ["dashboard", "▦", "Dashboard"],
            ["inventory", "▤", "Spare Parts"],
            ["add", "＋", "Add Product"],
            ["sales", "₱", "Sales"],
          ].map(([key, icon, label]) => (
            <button key={key} className={`nav-item ${page === key ? "active" : ""}`}
              onClick={() => goTo(key)}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-indicator" />
          <div><strong>Inventory workspace</strong><span>Manage parts and sales</span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><span className="breadcrumb">MotorParts / </span><strong>{pageTitle}</strong></div>
          <button className="btn btn-ghost refresh-button" onClick={refreshAll} disabled={loading}>
            ↻ Refresh
          </button>
        </header>

        <div className="page-content">
          {notice.text && (
            <div className={`notice ${notice.type}`} role="status">
              <span>{notice.type === "success" ? "✓" : "!"}</span>
              {notice.text}
              <button className="notice-close" onClick={() => setNotice({ type: "", text: "" })}>×</button>
            </div>
          )}

          {page === "dashboard" && (
            <>
              <section className="welcome-section">
                <div>
                  <p className="eyebrow">INVENTORY OVERVIEW</p>
                  <h1>Motor Shop Dashboard</h1>
                  <p className="welcome-description">Monitor spare parts, stock levels, and daily sales in one place.</p>
                </div>
                <button className="btn btn-primary" onClick={() => goTo("add")}>＋ Add Product</button>
              </section>

              <section className="stats-grid">
                {[
                  ["▤", "PRODUCT TYPES", stats.productTypes, "Registered spare parts", "icon-blue"],
                  ["▦", "TOTAL UNITS", stats.totalUnits.toLocaleString(), "Units currently in stock", "icon-purple"],
                  ["₱", "INVENTORY VALUE", formatPrice(stats.inventoryValue), "Based on selling prices", "icon-green"],
                  ["!", "LOW STOCK ITEMS", stats.needsAttention, "Products with 15 units or fewer", "icon-orange"],
                ].map(([icon, label, value, foot, color]) => (
                  <article className="stat-card" key={label}>
                    <div className="stat-top">
                      <span className={`stat-icon ${color}`}>{icon}</span>
                      <span className="stat-caption">{label}</span>
                    </div>
                    <strong className={`stat-value ${label === "INVENTORY VALUE" ? "stat-money" : ""}`}>{value}</strong>
                    <span className="stat-foot">{foot}</span>
                  </article>
                ))}
              </section>

              <section className="dashboard-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <div><h2>Stock Overview</h2><p>Products that may need restocking</p></div>
                    <button className="text-button" onClick={() => goTo("inventory")}>View inventory →</button>
                  </div>
                  {loading ? <div className="empty-state compact">Loading inventory...</div> :
                    products.length === 0 ? <div className="empty-state compact">Add your first spare part to begin.</div> : (
                      <div className="stock-list">
                        {[...products].sort((a, b) => Number(a.quantity) - Number(b.quantity))
                          .slice(0, 5).map((p) => {
                            const status = getStockStatus(p.quantity);
                            return (
                              <div className="stock-row" key={p._id}>
                                <div className="part-avatar">{p.name?.charAt(0).toUpperCase() || "?"}</div>
                                <div className="stock-part-info"><strong>{p.name}</strong><span>{p.category}</span></div>
                                <div className="stock-quantity"><strong>{p.quantity}</strong><span>units</span></div>
                                <span className={`stock-badge ${status.className}`}>{status.label}</span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                </article>

                <article className="panel today-panel">
                  <div className="panel-heading">
                    <div><h2>Today's Sales</h2><p>Summary of today's transactions</p></div>
                    <span className="stat-icon icon-green">₱</span>
                  </div>
                  <strong className="today-revenue">{formatPrice(stats.todayRevenue)}</strong>
                  <span className="stat-foot">Total recorded sales today</span>
                  <div className="today-divider" />
                  <div className="today-transactions"><span>Transactions today</span><strong>{stats.todayTransactions}</strong></div>
                  <button className="btn btn-primary btn-full" onClick={() => goTo("sales")}>Record a Sale</button>
                </article>
              </section>

              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div><h2>Recent Inventory</h2><p>Your latest product records</p></div>
                  <button className="text-button" onClick={() => goTo("inventory")}>Manage inventory →</button>
                </div>
                {renderProductTable(products.slice(0, 5))}
              </section>
            </>
          )}

          {page === "inventory" && (
            <>
              <section className="welcome-section">
                <div><p className="eyebrow">PRODUCT MANAGEMENT</p><h1>Spare Parts Inventory</h1>
                  <p className="welcome-description">Search, edit, and monitor your registered parts.</p></div>
                <button className="btn btn-primary" onClick={() => goTo("add")}>＋ Add Product</button>
              </section>
              <section className="panel inventory-panel">
                <div className="panel-heading"><div><h2>All Products</h2><p>{products.length} registered product types</p></div></div>
                <div className="filter-bar">
                  <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or category..." />
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option>All Categories</option>
                    {categories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                  <button className="btn btn-ghost" onClick={() => { setSearch(""); setCategoryFilter("All Categories"); }}>
                    Clear filters
                  </button>
                </div>
                {renderProductTable(filteredProducts, true)}
              </section>
            </>
          )}

          {page === "add" && (
            <>
              <section className="welcome-section">
                <div><p className="eyebrow">PRODUCT MANAGEMENT</p><h1>Add a Spare Part</h1>
                  <p className="welcome-description">Enter the details to add a product to your inventory.</p></div>
              </section>
              <section className="panel form-panel">
                <div className="panel-heading"><div><h2>Product Details</h2><p>Complete all fields before saving.</p></div></div>
                <form className="product-form" onSubmit={handleAddProduct}>
                  {renderProductFields(productForm, setProductForm)}
                  <div className="form-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setProductForm(emptyProduct)} disabled={saving}>Clear</button>
                    <button className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Product"}</button>
                  </div>
                </form>
              </section>
            </>
          )}

          {page === "sales" && (
            <>
              <section className="welcome-section">
                <div><p className="eyebrow">SALES MANAGEMENT</p><h1>Record a Sale</h1>
                  <p className="welcome-description">Record a purchase and update the remaining stock.</p></div>
              </section>

              <section className="sales-layout">
                <article className="panel form-panel">
                  <div className="panel-heading"><div><h2>New Transaction</h2><p>The current selling price is used.</p></div></div>
                  <form className="product-form" onSubmit={handleRecordSale}>
                    <label className="full-field">Select Product
                      <select name="productId" value={saleForm.productId}
                        onChange={(e) => updateForm(setSaleForm, e)} required>
                        <option value="">Choose a spare part</option>
                        {products.filter((p) => Number(p.quantity) > 0).map((p) => (
                          <option key={p._id} value={p._id}>{p.name} — {p.quantity} in stock</option>
                        ))}
                      </select>
                    </label>
                    <label className="full-field">Quantity Sold
                      <input type="number" name="quantity" min="1"
                        max={selectedProduct?.quantity || undefined} step="1"
                        value={saleForm.quantity} onChange={(e) => updateForm(setSaleForm, e)} required />
                    </label>
                    {selectedProduct && (
                      <div className="sale-summary full-field">
                        <div><span>Unit price</span><strong>{formatPrice(selectedProduct.price)}</strong></div>
                        <div><span>Available stock</span><strong>{selectedProduct.quantity} units</strong></div>
                        <div className="sale-total"><span>Transaction total</span><strong>{formatPrice(saleTotal)}</strong></div>
                      </div>
                    )}
                    <button className="btn btn-primary btn-full full-field" disabled={saving || !selectedProduct ||
                      !Number.isInteger(saleQuantity) || saleQuantity < 1 ||
                      saleQuantity > Number(selectedProduct?.quantity || 0)}>
                      {saving ? "Processing..." : "Complete Sale"}
                    </button>
                  </form>
                </article>

                <article className="panel sales-note">
                  <div className="stat-icon icon-green">✓</div>
                  <h2>Automatic Stock Update</h2>
                  <p>A successful sale should deduct the quantity sold and save the transaction in the sales collection.</p>
                  <div className="sales-note-stats">
                    <div><span>Transactions today</span><strong>{stats.todayTransactions}</strong></div>
                    <div><span>Sales recorded today</span><strong>{formatPrice(stats.todayRevenue)}</strong></div>
                  </div>
                </article>
              </section>

              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div><h2>Sales History</h2><p>Recorded transactions</p></div>
                  <span className="record-count">{sales.length} records</span>
                </div>
                {loading ? <div className="empty-state">Loading sales history...</div> :
                  sales.length === 0 ? <div className="empty-state"><strong>No sales recorded yet</strong><p>Completed transactions will appear here.</p></div> : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Date</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead>
                        <tbody>{sales.map((sale) => (
                          <tr key={sale._id}>
                            <td>{formatDate(sale.createdAt)}</td>
                            <td><strong>{sale.productName || "Unknown product"}</strong></td>
                            <td>{sale.quantity}</td><td>{formatPrice(sale.unitPrice)}</td>
                            <td><strong>{formatPrice(sale.total)}</strong></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
              </section>
            </>
          )}

          <footer className="app-footer">
            <span>MotorParts Inventory System</span>
            <span>Product and stock management</span>
          </footer>
        </div>
      </main>

      <AIInventoryAssistant />
    </div>
  );
}
