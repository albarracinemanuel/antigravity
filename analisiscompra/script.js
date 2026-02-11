// Estado Global de la Aplicación
const STATE = {
    providers: null, // Map<cod_alfa, {id, name, desc}>
    stock: null,     // Map<cod_alfa, { NOA: 0, BSAS: 0, CBA: 0, OTROS: 0 }>
    sales: null,     // Map<cod_alfa, { NOA: 0, BSAS: 0, CBA: 0, OTROS: 0 }>
    pending: null,   // Map<cod_alfa, { NOA: 0, BSAS: 0, CBA: 0, OTROS: 0 }> NEW
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
    dateRangeInfo: document.getElementById('date-range-info')
};

// --- Inicialización ---
setupDragDrop(dom.dropProviders, dom.fileProviders, handleProvidersFile);
setupDragDrop(dom.dropStock, dom.fileStock, handleStockFile);
setupDragDrop(dom.dropSales, dom.fileSales, handleSalesFile);
setupDragDrop(dom.dropPending, dom.filePending, handlePendingFile); // NEW

dom.providerSelect.addEventListener('change', renderTable);
dom.projectionMonths.addEventListener('change', renderTable);
document.getElementById('btn-export').addEventListener('click', exportToExcel);

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
            STATE.sales = {};
            let count = 0;
            let minTimestamp = Infinity;
            let maxTimestamp = -Infinity;

            results.data.forEach(row => {
                const code = normalizeText(row.cod_alfa || row.COD_ALFA);
                if (!isValidProductCode(code)) return;
                const area = row.nom_area || row.NOM_AREA;
                let qty = parseFloat(row.cantidad || row.CANTIDAD || 0);
                if (isNaN(qty)) qty = 0;

                const dateStr = row.fecha || row.FECHA;
                if (dateStr) {
                    const dateObj = parseDate(dateStr);
                    if (dateObj && !isNaN(dateObj.getTime())) {
                        const ts = dateObj.getTime();
                        if (ts < minTimestamp) minTimestamp = ts;
                        if (ts > maxTimestamp) maxTimestamp = ts;
                    }
                }

                if (code && area) {
                    const zone = getZone(area);
                    if (!STATE.sales[code]) STATE.sales[code] = { "NOA": 0, "BUENOS AIRES": 0, "CORDOBA": 0, "OTROS": 0 };
                    STATE.sales[code][zone] += qty;
                    count++;
                }
            });

            let months = 1;
            if (minTimestamp !== Infinity && maxTimestamp !== -Infinity) {
                const diffTime = Math.abs(maxTimestamp - minTimestamp);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                months = (diffDays / 30).toFixed(1);
                dom.historyMonths.value = months;
                const minDate = new Date(minTimestamp).toLocaleDateString();
                const maxDate = new Date(maxTimestamp).toLocaleDateString();
                dom.dateRangeInfo.textContent = `Rango detectado: ${minDate} - ${maxDate} (${diffDays} días)`;
                STATE.salesDateRange = { min: minDate, max: maxDate, months: parseFloat(months) };
            } else {
                dom.dateRangeInfo.textContent = "No detectado. Base: 1 mes.";
                dom.historyMonths.value = 1;
                STATE.salesDateRange.months = 1;
            }

            updateStatus(dom.statusSales, `✅ Cargado (${count} ventas)`, true);
            checkAppReady();
        },
        error: (err) => { console.error(err); updateStatus(dom.statusSales, "❌ Error CSV"); }
    });
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
    let productsList = [];

    if (isTop200) {
        productsList = Object.keys(STATE.providers);
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
        dom.providerStats.textContent = `Mostrando los 200 productos más vendidos globalmente (Base: ${histMonths} meses)`;
    } else {
        dom.providerStats.textContent = `Mostrando ${displayList.length} productos de ${selectedValue} (Base: ${histMonths} meses)`;
    }

    const thead = dom.resultsTable.querySelector('thead');
    const tbody = dom.resultsTable.querySelector('tbody');

    let headerHTML = `
        <tr>
            <th>Producto</th>
            <th>Descripción</th>
    `;
    if (isTop200) headerHTML += `<th>Proveedor</th>`;

    const zones = ["NOA", "BUENOS AIRES", "CORDOBA"];
    zones.forEach(z => {
        headerHTML += `<th colspan="5" class="group-header">${z}</th>`; // colspan 5
    });
    headerHTML += `</tr><tr><th></th><th></th>${isTop200 ? '<th></th>' : ''}`;

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

        const tr = document.createElement('tr');

        let rowHTML = `
            <td>${code}</td>
            <td>${prodData.desc}</td>
        `;

        if (isTop200) rowHTML += `<td style="font-size: 0.8em; color: #64748b;">${prodData.name}</td>`;

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

            let stockClass = "val-stock";
            if (stock < (monthlyAvg * 2)) stockClass += " stock-critical";
            else if (stock > (monthlyAvg * 6)) stockClass += " stock-excess";

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
