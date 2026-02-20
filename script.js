// Estado Global de la Aplicación
const STATE = {
    providers: null, // Map<cod_alfa, {id, name, desc}>
    stock: null,     // Map<cod_alfa, { NOA: 0, BSAS: 0, CBA: 0, OTROS: 0 }>
    sales: null,     // Map<cod_alfa, { NOA: 0, BSAS: 0, CBA: 0, OTROS: 0 }> (Processed)
    rawSales: [],    // Array<{code, area, qty, date}> (Raw Data)
    pending: null,   // Map<cod_alfa, { NOA: 0, BSAS: 0, CBA: 0, OTROS: 0 }> NEW
    abc: null,       // Map<cod_alfa, 'A'|'B'|'C'>
    salesDateRange: { min: null, max: null, months: 1 },
    providersList: new Set(),
    appReady: false
};

// Códigos a excluir
const BLACKLIST_CODES = ["38952-F1", "004-SEGVIDA"];

// Configuración de Zonas
const ZONES_CONFIG = {
    "NOA": ["CENTRAL", "SALTA", "JUJUY", "NORTE INTERIOR", "NORTE CENTRO", "TUC CAPITAL", "TUC INTERIOR", "CATAMARCA", "SANTIAGO", "LA RIOJA"],
    "BUENOS AIRES": ["CABA SAN CRISTOBAL", "MORON", "LANUS"],
    "CORDOBA": ["CORDOBA"]
};

const AREA_MAP = {};
for (const [zone, areas] of Object.entries(ZONES_CONFIG)) {
    areas.forEach(area => AREA_MAP[area] = zone);
}

const dom = {
    dropProviders: document.getElementById('drop-providers'),
    dropStock: document.getElementById('drop-stock'),
    dropSales: document.getElementById('drop-sales'),
    dropPending: document.getElementById('drop-pending'), // NEW
    fileProviders: document.getElementById('file-providers'),
    fileStock: document.getElementById('file-stock'),
    fileSales: document.getElementById('file-sales'),
    filePending: document.getElementById('file-pending'), // NEW
    statusProviders: document.getElementById('status-providers'),
    statusStock: document.getElementById('status-stock'),
    statusSales: document.getElementById('status-sales'),
    statusPending: document.getElementById('status-pending'), // NEW
    filterSection: document.getElementById('filter-section'),
    providerSelect: document.getElementById('provider-select'),
    resultsSection: document.getElementById('results-section'),
    resultsTable: document.getElementById('results-table'),
    historyMonths: document.getElementById('historyMonths'),
    projectionMonths: document.getElementById('projectionMonths'),
    providerStats: document.getElementById('provider-stats'),
    dateRangeInfo: document.getElementById('date-range-info'),
    dateFrom: document.getElementById('date-from'),
    dateTo: document.getElementById('date-to'),
    // Efficient Mode Elements
    tabsContainer: document.getElementById('tabs-container'),
    resultsSectionGeneral: document.getElementById('results-section'),
    resultsSectionEfficient: document.getElementById('results-efficient-section'),
    resultsTableEfficient: document.getElementById('results-table-efficient'),
    resultsTableEfficient: document.getElementById('results-table-efficient'),
    efficientLT: document.getElementById('efficient-lt'),
    btnRecalcEfficient: document.getElementById('btn-recalc-efficient'),
    btnExportEfficient: document.getElementById('btn-export-efficient'),
    tabs: document.querySelectorAll('.tab-btn')
};

// --- Inicialización ---
setupDragDrop(dom.dropProviders, dom.fileProviders, handleProvidersFile);
setupDragDrop(dom.dropStock, dom.fileStock, handleStockFile);
setupDragDrop(dom.dropSales, dom.fileSales, handleSalesFile);
setupDragDrop(dom.dropPending, dom.filePending, handlePendingFile); // NEW

dom.providerSelect.addEventListener('change', () => { renderTable(); renderEfficientTable(); });
dom.projectionMonths.addEventListener('change', renderTable);
dom.dateFrom.addEventListener('change', filterAndProcessSales);
dom.dateTo.addEventListener('change', filterAndProcessSales);
document.getElementById('btn-export').addEventListener('click', exportToExcel);

// Efficient Mode Listeners
dom.tabs.forEach(btn => {
    btn.addEventListener('click', () => {
        dom.tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        if (tab === 'general') {
            dom.resultsSectionGeneral.style.display = 'block';
            dom.resultsSectionEfficient.style.display = 'none';
        } else {
            dom.resultsSectionGeneral.style.display = 'none';
            dom.resultsSectionEfficient.style.display = 'block';
            renderEfficientTable();
        }
    });
});
dom.btnRecalcEfficient.addEventListener('click', renderEfficientTable);
dom.btnExportEfficient.addEventListener('click', exportToExcelEfficient);

// --- Utils ---
function normalizeText(text) {
    if (!text) return "";
    return text.toString().trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isValidProductCode(code) {
    if (!code) return false;
    if (/^[A-Z]/i.test(code)) return false;
    if (BLACKLIST_CODES.includes(code)) return false;
    return true;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return null;
}

function getZone(areaName) {
    const norm = normalizeText(areaName);
    if (AREA_MAP[norm]) return AREA_MAP[norm];
    for (const [areaByKey, zone] of Object.entries(AREA_MAP)) {
        if (norm.includes(areaByKey)) return zone;
    }
    return "OTROS";
}

function setupDragDrop(zone, input, handler) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('active'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('active'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('active');
        if (e.dataTransfer.files[0]) handler(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', e => {
        if (e.target.files[0]) handler(e.target.files[0]);
    });
}

function updateStatus(element, msg, success = false) {
    element.textContent = msg;
    element.parentElement.classList.toggle('uploaded', success);
}

function checkAppReady() {
    // Ahora requiere los 4 archivos
    if (STATE.providers && STATE.stock && STATE.sales && STATE.pending) {
        STATE.appReady = true;

        const activeProviders = new Set();
        Object.keys(STATE.sales).forEach(code => {
            if (STATE.providers[code]) {
                const provName = STATE.providers[code].name;
                const salesData = STATE.sales[code];
                const total = (salesData["NOA"] || 0) + (salesData["BUENOS AIRES"] || 0) + (salesData["CORDOBA"] || 0);
                if (total > 0) activeProviders.add(provName);
            }
        });

        const sortedActiveProviders = Array.from(activeProviders).sort();

        dom.providerSelect.innerHTML = '<option value="">-- Elija un Proveedor --</option>';

        const topOption = document.createElement('option');
        topOption.value = "TOP200";
        topOption.textContent = "*** 200 MAS VENDIDOS (GLOBAL) ***";
        topOption.style.fontWeight = "bold";
        dom.providerSelect.appendChild(topOption);

        const highRotationOption = document.createElement('option');
        highRotationOption.value = "HIGH_ROTATION";
        highRotationOption.textContent = "🔥 ALTA ROTACIÓN (CATEGORÍA A)";
        highRotationOption.style.fontWeight = "bold";
        highRotationOption.style.color = "#d97706";
        dom.providerSelect.appendChild(highRotationOption);

        if (sortedActiveProviders.length === 0) {
            const noSalesOption = document.createElement('option');
            noSalesOption.disabled = true;
            noSalesOption.textContent = "(No se encontraron ventas vinculadas)";
            dom.providerSelect.appendChild(noSalesOption);
        } else {
            sortedActiveProviders.forEach(p => {
                const option = document.createElement('option');
                option.value = p;
                option.textContent = p;
                dom.providerSelect.appendChild(option);
            });
        }

        dom.filterSection.style.display = 'block';
        setTimeout(() => dom.filterSection.style.opacity = '1', 10);
        dom.tabsContainer.style.display = 'flex'; // Show tabs
        dom.providerStats.textContent = `Lista (Activos): ${sortedActiveProviders.length} proveedores.`;
    }
}

// --- File Handlers ---
function handleProvidersFile(file) {
    updateStatus(dom.statusProviders, "Leyendo...");
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            STATE.providers = {};
            STATE.providersList.clear();
            let count = 0;
            json.forEach(row => {
                const code = normalizeText(row.cod_alfa || row.COD_ALFA || row.Cod_alfa);
                if (!isValidProductCode(code)) return;
                const provName = row.ult_provee || row.ULT_PROVEE || row.proveedor || "SIN PROVEEDOR";
                const desc = row.detalle || row.DETALLE || "";

                STATE.providers[code] = { name: provName, desc: desc };
                STATE.providersList.add(provName);
                count++;
            });
            updateStatus(dom.statusProviders, `✅ Cargado (${count} prods)`, true);
            checkAppReady();
        } catch (err) { console.error(err); updateStatus(dom.statusProviders, "❌ Error XLS"); }
    };
    reader.readAsArrayBuffer(file);
}

function handleStockFile(file) {
    updateStatus(dom.statusStock, "Leyendo...");
    Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
            STATE.stock = {};
            let count = 0;
            results.data.forEach(row => {
                const code = normalizeText(row.codalfa || row.CODALFA || row.Codalfa);
                if (!isValidProductCode(code)) return;
                const area = row.nom_area || row.NOM_AREA;
                let qty = parseFloat(row.disponible || row.DISPONIBLE || 0);
                if (isNaN(qty)) qty = 0;
                if (code && area) {
                    const zone = getZone(area);
                    if (!STATE.stock[code]) STATE.stock[code] = { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0, "OTROS": 0 };
                    STATE.stock[code][zone] += qty;
                    count++;
                }
            });
            updateStatus(dom.statusStock, `✅ Cargado (${count} items)`, true);
            checkAppReady();
        },
        error: (err) => { console.error(err); updateStatus(dom.statusStock, "❌ Error CSV"); }
    });
}

function handleSalesFile(file) {
    updateStatus(dom.statusSales, "Leyendo...");
    Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
            STATE.rawSales = [];
            let minTimestamp = Infinity;
            let maxTimestamp = -Infinity;

            results.data.forEach(row => {
                const code = normalizeText(row.cod_alfa || row.COD_ALFA);
                if (!isValidProductCode(code)) return;
                const area = row.nom_area || row.NOM_AREA;
                let qty = parseFloat(row.cantidad || row.CANTIDAD || 0);
                if (isNaN(qty)) qty = 0;

                const dateStr = row.fecha || row.FECHA;
                let dateObj = null;
                if (dateStr) {
                    dateObj = parseDate(dateStr);
                    if (dateObj && !isNaN(dateObj.getTime())) {
                        const ts = dateObj.getTime();
                        if (ts < minTimestamp) minTimestamp = ts;
                        if (ts > maxTimestamp) maxTimestamp = ts;
                    }
                }

                if (code && area) {
                    STATE.rawSales.push({ code, area, qty, date: dateObj });
                }
            });

            // Set default date range inputs
            if (minTimestamp !== Infinity && maxTimestamp !== -Infinity) {
                dom.dateFrom.valueAsDate = new Date(minTimestamp);
                dom.dateTo.valueAsDate = new Date(maxTimestamp);
            }

            updateStatus(dom.statusSales, `✅ Cargado (${STATE.rawSales.length} regs)`, true);
            filterAndProcessSales(); // Initial process
        },
        error: (err) => { console.error(err); updateStatus(dom.statusSales, "❌ Error CSV"); }
    });
}

function filterAndProcessSales() {
    if (!STATE.rawSales || STATE.rawSales.length === 0) return;

    const fromDate = dom.dateFrom.valueAsDate;
    const toDate = dom.dateTo.valueAsDate;

    if (!fromDate || !toDate) return;

    // Validate range
    if (fromDate > toDate) {
        alert("La fecha 'Desde' no puede ser mayor que 'Hasta'");
        return;
    }

    // Filter and Aggregate
    STATE.sales = {};
    let count = 0;

    STATE.rawSales.forEach(item => {
        if (item.date && item.date >= fromDate && item.date <= toDate) {
            const zone = getZone(item.area);
            if (!STATE.sales[item.code]) STATE.sales[item.code] = { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0, "OTROS": 0 };
            STATE.sales[item.code][zone] += item.qty;
            count++;
        }
    });

    // Calculate Months in Range
    const diffTime = Math.abs(toDate - fromDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const months = (diffDays / 30).toFixed(1); // 1 month = 30 days approx

    dom.historyMonths.value = months;
    STATE.salesDateRange = {
        min: fromDate.toLocaleDateString(),
        max: toDate.toLocaleDateString(),
        months: parseFloat(months)
    };

    console.log(`Filtered Sales: ${count} transactions. Range: ${months} months.`);

    calculateABC();

    if (STATE.appReady) {
        renderTable();
        renderEfficientTable();
    } else {
        checkAppReady();
    }
}

// NEW: Handle Pending
function handlePendingFile(file) {
    updateStatus(dom.statusPending, "Leyendo...");
    Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
            STATE.pending = {}; // init
            let count = 0;
            results.data.forEach(row => {
                const code = normalizeText(row.cod_alfa || row.COD_ALFA || row.Cod_alfa);
                if (!isValidProductCode(code)) return;
                const area = row.nom_area || row.NOM_AREA;
                let qty = parseFloat(row.pendiente || row.PENDIENTE || 0);
                if (isNaN(qty)) qty = 0;

                if (code && area) {
                    const zone = getZone(area);
                    if (!STATE.pending[code]) STATE.pending[code] = { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0, "OTROS": 0 };
                    STATE.pending[code][zone] += qty;
                    count++;
                }
            });
            updateStatus(dom.statusPending, `✅ Cargado (${count} items)`, true);
            checkAppReady();
        },
        error: (err) => { console.error(err); updateStatus(dom.statusPending, "❌ Error CSV"); }
    });
}

function calculateABC() {
    if (!STATE.sales) return;

    // 1. Agrupar ventas totales por producto
    const productSales = [];
    Object.entries(STATE.sales).forEach(([code, data]) => {
        const total = (data["NOA"] || 0) + (data["BUENOS AIRES"] || 0) + (data["CORDOBA"] || 0) + (data["OTROS"] || 0);
        if (total > 0) {
            productSales.push({ code, total });
        }
    });

    // 2. Ordenar de mayor a menor
    productSales.sort((a, b) => b.total - a.total);

    // 3. Calcular total general
    const totalGrand = productSales.reduce((sum, item) => sum + item.total, 0);

    // 4. Asignar categorías (Pareto 80/15/5)
    let accumulated = 0;
    STATE.abc = {};

    productSales.forEach(item => {
        accumulated += item.total;
        const percentage = (accumulated / totalGrand) * 100;

        let category = 'C';
        if (percentage <= 80) category = 'A';
        else if (percentage <= 95) category = 'B';

        STATE.abc[item.code] = category;
    });
}

// --- Render Logic ---
function renderTable() {
    if (!STATE.appReady) return;

    const selectedValue = dom.providerSelect.value;
    const histMonths = parseFloat(dom.historyMonths.value) || 1;
    const projMonths = parseFloat(dom.projectionMonths.value) || 2;

    if (!selectedValue) {
        dom.resultsSection.style.display = 'none';
        return;
    }

    const isTop200 = selectedValue === "TOP200";
    const isHighRotation = selectedValue === "HIGH_ROTATION";
    let productsList = [];

    if (isTop200) {
        productsList = Object.keys(STATE.providers);
    } else if (isHighRotation) {
        productsList = Object.keys(STATE.providers).filter(code => STATE.abc && STATE.abc[code] === 'A');
    } else {
        productsList = Object.entries(STATE.providers)
            .filter(([code, data]) => data.name === selectedValue)
            .map(([code, data]) => code);
    }

    const rankedProducts = productsList.map(code => {
        const salesData = STATE.sales[code] || { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0 };
        const totalSales = (salesData["NOA"] || 0) + (salesData["BUENOS AIRES"] || 0) + (salesData["CORDOBA"] || 0);
        return {
            code,
            totalSales,
            prodData: STATE.providers[code]
        };
    });

    rankedProducts.sort((a, b) => b.totalSales - a.totalSales);

    let displayList = rankedProducts;
    if (isTop200) {
        displayList = rankedProducts.slice(0, 200);
        displayList = rankedProducts.slice(0, 200);
        dom.providerStats.textContent = `Mostrando los 200 productos más vendidos globalmente (Base: ${histMonths} meses)`;
    } else if (isHighRotation) {
        dom.providerStats.textContent = `Mostrando ${displayList.length} productos de Alta Rotación (Categoría A) (Base: ${histMonths} meses)`;
    } else {
        dom.providerStats.textContent = `Mostrando ${displayList.length} productos de ${selectedValue} (Base: ${histMonths} meses)`;
    }

    const thead = dom.resultsTable.querySelector('thead');
    const tbody = dom.resultsTable.querySelector('tbody');

    let headerHTML = `
        <tr>
            <th>Producto</th>
            <th>Descripción</th>
            <th class="col-category">Cat.</th>
    `;
    if (isTop200 || isHighRotation) headerHTML += `<th>Proveedor</th>`;

    const zones = ["NOA", "BUENOS AIRES", "CORDOBA"];
    zones.forEach(z => {
        headerHTML += `<th colspan="5" class="group-header">${z}</th>`; // colspan 5
    });
    headerHTML += `</tr><tr><th></th><th></th><th></th>${(isTop200 || isHighRotation) ? '<th></th>' : ''}`;

    zones.forEach(z => {
        headerHTML += `
            <th class="col-data" style="font-size:0.85em">Stock</th>
            <th style="font-size:0.85em">Pend.</th>
            <th style="font-size:0.85em">Ventas</th>
            <th style="font-size:0.85em">Estim.</th>
            <th style="font-size:0.85em; background:#f0f9ff">Sug.</th>
        `;
    });
    headerHTML += `</tr>`;
    thead.innerHTML = headerHTML;

    tbody.innerHTML = "";

    displayList.forEach(item => {
        const code = item.code;
        const prodData = item.prodData;
        const stockData = STATE.stock[code] || { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0 };
        const salesData = STATE.sales[code] || { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0 };
        const pendingData = STATE.pending[code] || { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0 }; // NEW
        const category = (STATE.abc && STATE.abc[code]) ? STATE.abc[code] : '-';

        const tr = document.createElement('tr');

        // Add Layout Class
        if (category === 'A') tr.classList.add('categoria-a');
        else if (category === 'B') tr.classList.add('categoria-b');
        else if (category === 'C') tr.classList.add('categoria-c');

        let rowHTML = `
            <td>${code}</td>
            <td>${prodData.desc}</td>
            <td class="col-category">${category}</td>
        `;

        if (isTop200 || isHighRotation) rowHTML += `<td style="font-size: 0.8em; color: #64748b;">${prodData.name}</td>`;

        zones.forEach(z => {
            const stock = stockData[z] || 0;
            const sales = salesData[z] || 0;
            const pending = pendingData[z] || 0;

            const monthlyAvg = sales / histMonths;
            const estimated = Math.ceil(monthlyAvg * projMonths);

            // Formula Maestra: Sugerido = Estimado - Stock - Pendiente
            let suggested = estimated - stock - pending;
            if (suggested < 0) suggested = 0;
            suggested = Math.ceil(suggested);

            // Color Logic: Stock + Pending vs Estimates
            // REMOVED: Red/Green logic based on user request.
            // Keeping stockClass for potential future use or just structure.
            let stockClass = "val-stock";

            // Highlight suggested
            let suggStyle = "";
            if (suggested > 0) suggStyle = "font-weight:bold; color: #2563eb; background:#f0f9ff";

            // Si hay pendiente, mostrarlo en gris oscuro, sino claro
            const pendStyle = pending > 0 ? "color:#475569; font-weight:500" : "color:#cbd5e1";

            rowHTML += `
                <td class="col-data ${stockClass}">${stock}</td>
                <td style="${pendStyle}">${pending}</td>
                <td class="val-sales">${sales}</td>
                <td class="val-est">${estimated}</td>
                <td style="${suggStyle}">${suggested}</td>
            `;
        });

        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });

    dom.resultsSection.style.display = 'block';
}

function exportToExcel() {
    if (!STATE.appReady) return;

    const table = document.getElementById('results-table');
    if (!table) return;

    // Create workbook from table
    const wb = XLSX.utils.table_to_book(table, { sheet: "Stock Analysis" });

    // Generate filename with date
    const today = new Date().toISOString().split('T')[0];
    const filename = `analisis_stock_${today}.xlsx`;

    // Write file
    XLSX.writeFile(wb, filename);
}

// --- Efficient Mode Logic ---

function renderEfficientTable() {
    if (!STATE.appReady) return;

    const selectedProvider = dom.providerSelect.value;
    if (!selectedProvider || selectedProvider === "TOP200" || selectedProvider === "HIGH_ROTATION") {
        let displayVal = selectedProvider || 'Ninguno';
        dom.resultsTableEfficient.innerHTML = `<tbody><tr><td>Seleccione un único proveedor válido para el análisis eficiente. (Valor actual no válido: '${displayVal}')</td></tr></tbody>`;
        return;
    }

    // Config
    const leadTime = parseInt(dom.efficientLT.value) || 20;

    // Use Global Sales Data (Already filtered by Date Range)
    // STATE.salesDateRange has { min, max, months }
    const monthsAnalysis = STATE.salesDateRange.months || 1;
    const daysAnalysis = Math.max(1, Math.round(monthsAnalysis * 30));


    // Get products for provider
    const products = Object.entries(STATE.providers)
        .filter(([code, data]) => data.name === selectedProvider)
        .map(([code, data]) => code);

    // Analyze Provider Trigger
    let providerTrigger = false;
    const analysisData = [];

    products.forEach(code => {
        const prodData = STATE.providers[code];
        const stockData = STATE.stock[code] || { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0 };
        const totalStock = (stockData["NOA"] || 0) + (stockData["BUENOS AIRES"] || 0) + (stockData["CORDOBA"] || 0);

        const pendingData = STATE.pending[code] || { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0, "OTROS": 0 };
        const totalPending = (pendingData["NOA"] || 0) + (pendingData["BUENOS AIRES"] || 0) + (pendingData["CORDOBA"] || 0) + (pendingData["OTROS"] || 0);
        const projectedStock = totalStock + totalPending;

        const category = (STATE.abc && STATE.abc[code]) ? STATE.abc[code] : 'C'; // Default C

        const salesData = STATE.sales[code] || { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0, "OTROS": 0 };
        const salesQty = (salesData["NOA"] || 0) + (salesData["BUENOS AIRES"] || 0) + (salesData["CORDOBA"] || 0) + (salesData["OTROS"] || 0);

        const dailyDemand = salesQty / daysAnalysis;
        const monthlyDemand = dailyDemand * 30;
        const demandLT = dailyDemand * leadTime;

        // Logic by Category
        let rop = 0;
        let targetStock = 0;
        let isRisk = false;

        if (category === 'A') {
            rop = demandLT * 1.10;
            targetStock = monthlyDemand * 2;
            // Trigger check
            if (projectedStock <= rop) providerTrigger = true;
            // Critical Risk check
            const daysStock = dailyDemand > 0 ? totalStock / dailyDemand : 0;
            if (daysStock < (leadTime - 5)) isRisk = true;

        } else if (category === 'B') {
            rop = demandLT * 1.10;
            targetStock = monthlyDemand * 1.5;
        } else {
            // C: Bajo pedido
            targetStock = 0; // Se calcula dinámicamente si hay pedido
        }

        analysisData.push({
            code,
            desc: prodData.desc,
            category,
            stock: totalStock,
            pending: totalPending,
            projectedStock: projectedStock,
            salesQty,
            dailyDemand,
            rop,
            targetStock,
            isRisk
        });
    });

    // Calculate Suggested
    analysisData.forEach(item => {
        item.suggested = 0;
        if (providerTrigger) {
            if (item.category === 'A' || item.category === 'B') {
                if (item.projectedStock < item.targetStock) {
                    item.suggested = Math.ceil(item.targetStock - item.projectedStock);
                }
            } else if (item.category === 'C') {
                // Reponer solo si hubo ventas recientes (modelo simple: reponer lo vendido si no hay stock)
                // O según regla: "Si hubo ventas -> reponer únicamente lo vendido"
                // Asumimos que si stock < ventasQty, reponemos la diferencia
                // Para simplificar según requerimiento: "Si hubo ventas -> reponer únicamente lo vendido" -> Target = Ventas
                if (item.salesQty > 0) {
                    const gap = item.salesQty - item.projectedStock;
                    if (gap > 0) item.suggested = Math.ceil(gap);
                }
            }
        }
    });

    // Render
    // Sort: A risk -> A -> B -> C
    analysisData.sort((a, b) => {
        if (a.category === 'A' && b.category !== 'A') return -1;
        if (b.category === 'A' && a.category !== 'A') return 1;
        if (a.category === 'A' && b.category === 'A') return (a.stock / a.dailyDemand) - (b.stock / b.dailyDemand); // Menor días stock primero
        return 0;
    });

    const thead = dom.resultsTableEfficient.querySelector('thead');
    const tbody = dom.resultsTableEfficient.querySelector('tbody');

    const minDateInfo = STATE.salesDateRange.min || "?";
    const maxDateInfo = STATE.salesDateRange.max || "?";

    thead.innerHTML = `
        <tr>
            <th colspan="11" style="background:#f1f5f9; color:#475569; font-size:0.9em; text-align:left; border:none;">
                Periodo Analizado: ${minDateInfo} - ${maxDateInfo} (${daysAnalysis} días aprox)
            </th>
        </tr>
        <tr>
            <th>Cat</th>
            <th>Producto</th>
            <th>Descripción</th>
            <th>Stock Act.</th>
            <th>Pend.</th>
            <th>Stock Proy.</th>
            <th>Ventas</th>
            <th>Días Stock</th>
            <th>ROP</th>
            <th>Meta</th>
            <th>Sugerido</th>
        </tr>
    `;

    tbody.innerHTML = "";

    analysisData.forEach(item => {
        const daysStock = item.dailyDemand > 0 ? (item.stock / item.dailyDemand).toFixed(1) : "∞";
        const tr = document.createElement('tr');

        // Style row based on cat
        if (item.category === 'A') tr.classList.add('categoria-a');
        else if (item.category === 'B') tr.classList.add('categoria-b');
        else if (item.category === 'C') tr.classList.add('categoria-c');

        const riskBadge = item.isRisk ? '<span class="alert-risk">⚠ RIESGO</span>' : '';
        const suggStyle = item.suggested > 0 ? "font-weight:bold; color: #2563eb; background:#f0f9ff" : "";

        tr.innerHTML = `
            <td class="col-category">${item.category} ${riskBadge}</td>
            <td>${item.code}</td>
            <td>${item.desc}</td>
            <td>${item.stock}</td>
            <td>${item.pending}</td>
            <td>${item.projectedStock}</td>
            <td>${item.salesQty}</td>
            <td>${daysStock}</td>
            <td>${Math.ceil(item.rop)}</td>
            <td>${Math.ceil(item.targetStock)}</td>
            <td style="${suggStyle}">${item.suggested}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportToExcelEfficient() {
    const table = document.getElementById('results-table-efficient');
    if (!table) return;
    const wb = XLSX.utils.table_to_book(table, { sheet: "Eficiencia" });
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `analisis_eficiente_${today}.xlsx`);
}
