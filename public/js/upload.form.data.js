
// 全局变量
let table = null;
let allData = [];
let fileCounter = 0;
let columnsSet = new Set();

// 初始化表格
function initTable() {
    table = new Tabulator("#dataTable", {
        layout: "fitColumns",
        pagination: "local",
        paginationSize: 10,
        paginationSizeSelector: false,
        movableColumns: true,
        resizableRows: true,
        selectable: true,
        selectableRangeMode: "click",
        history: true,
        addRowPos: "top",
        columns: [],
        data: [],
        cellEdited: function (cell) {
            updateStatusBar();
            console.log("单元格编辑:", cell.getField(), cell.getValue());
        },
        rowSelected: function (row) {
            updateSelectedCount();
        },
        rowDeselected: function (row) {
            updateSelectedCount();
        },
        rowSelectionChanged: function (data, rows) {
            updateSelectedCount();
        }
    });

    // 分页大小变化事件
    document.getElementById('pageSize').addEventListener('change', function () {
        table.setPageSize(parseInt(this.value));
    });
}

// 初始化拖放功能
function initDragDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    // 点击区域触发文件选择
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // 文件选择事件
    fileInput.addEventListener('change', handleFile);

    // 拖放事件处理
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        if (e.dataTransfer.files.length) {
            handleFile(e);
        }
    });
}

// 处理上传的文件
function handleFile(e) {
    const files = e.target?.files || e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
        processFile(file);
    });

    // 重置文件输入，允许重复上传同一文件
    if (e.target) {
        e.target.value = '';
    }
}

// 处理单个文件
function processFile(file) {
    fileCounter++;

    // 显示文件信息
    const fileInfoDiv = document.getElementById('fileInfo');
    fileInfoDiv.innerHTML = `
                <h4>📄 正在处理: ${file.name}</h4>
                <p>类型: ${file.type || '未知'} | 大小: ${(file.size / 1024).toFixed(2)} KB</p>
                <p>进度: <span id="progress${fileCounter}">解析中...</span></p>
            `;

    const reader = new FileReader();

    reader.onload = function (event) {
        try {
            const data = new Uint8Array(event.target.result);
            let newData = [];

            if (file.name.toLowerCase().endsWith('.csv')) {
                // 处理CSV文件
                const csvText = new TextDecoder().decode(data);
                newData = parseCSV(csvText, file.name);
            } else {
                // 处理Excel文件
                const workbook = XLSX.read(data, { type: 'array' });
                newData = parseExcel(workbook);
            }

            // 更新列集合
            if (newData.length > 0) {
                newData.map(newData => {
                    Object.keys(newData).forEach(key => {
                        if (!columnsSet.has(key)) {
                            columnsSet.add(key);
                        }
                    });
                })

                // 添加数据到表格
                addDataToTable(newData);

                // 更新进度
                document.getElementById(`progress${fileCounter}`).innerHTML =
                    `✅ 完成 - 添加了 ${newData.length} 行数据`;
            }

            updateStatusBar();
        } catch (error) {
            console.error('解析错误:', error);
            document.getElementById(`progress${fileCounter}`).innerHTML =
                `❌ 解析失败: ${error.message}`;
        }
    };

    reader.readAsArrayBuffer(file);
}

// 解析CSV文件
function parseCSV(csvText, fileName) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const values = lines[i].split(',');

        headers.forEach((header, index) => {
            obj[header] = values[index] ? values[index].trim() : '';
        });

        // 添加文件来源信息
        obj['__source_file__'] = fileName;
        obj['__source_type__'] = 'CSV';

        result.push(obj);
    }

    return result;
}

// 解析Excel文件
function parseExcel(workbook) {
    let allData = [];

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        jsonData.forEach(row => {
            // 添加工作表信息
            row['__source_sheet__'] = sheetName;
            row['__source_file__'] = workbook.SheetNames.length > 1 ? `${workbook.SheetNames[0]}_workbook` : 'excel_file';
            row['__source_type__'] = 'Excel';
            allData.push(row);
        });
    });

    return allData;
}

// 添加数据到表格
function addDataToTable(newData) {
    if (newData) {
        allData = allData.concat(newData);
    }

    // 构建列配置
    const columns = Array.from(columnsSet).toSorted().map(field => {
        return {
            title: field,
            field: field,
            editor: "input",
            headerFilter: "input",
            headerFilterParams: { placeholder: `筛选 ${field}` },
            headerSort: true,
            resizable: true
        };
    });

    // 更新表格列和数据
    table.setColumns(columns);
    table.setData(allData);

    // 更新状态
    document.getElementById('lastUpdate').textContent =
        `最后更新: ${new Date().toLocaleTimeString()}`;
}

// 添加新行
function addNewRow() {
    const newRow = {};
    if (columnsSet.size === 0) {
        ['项目', '值', '__source_type__', '__added_date__'].map(k => columnsSet.add(k))
    }
    columnsSet.forEach(col => {
        newRow[col] = '';
    });
    newRow['__source_type__'] = '手动添加';
    newRow['__added_date__'] = new Date().toLocaleString();

    allData.unshift(newRow);
    // table.addRow(newRow, true);
    addDataToTable();
    table.setPage(1);
    updateStatusBar();
}

// 删除选中行
function deleteSelectedRows() {
    const selectedRows = table.getSelectedRows();
    if (selectedRows.length === 0) {
        alert('请先选择要删除的行！');
        return;
    }

    if (confirm(`确定要删除选中的 ${selectedRows.length} 行数据吗？`)) {
        selectedRows.forEach(row => {
            const index = allData.findIndex(item =>
                JSON.stringify(item) === JSON.stringify(row.getData()));
            if (index !== -1) {
                allData.splice(index, 1);
            }
            row.delete();
        });
        updateStatusBar();
    }
}

// 导出为Excel
function exportToExcel() {
    if (allData.length === 0) {
        alert('没有数据可导出！');
        return;
    }

    // 准备数据（移除内部字段）
    const exportData = allData.map(row => {
        const newRow = { ...row };
        delete newRow.__source_file__;
        delete newRow.__source_sheet__;
        delete newRow.__source_type__;
        delete newRow.__added_date__;
        return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "数据导出");

    XLSX.writeFile(workbook, `数据导出_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// 清空所有数据
function clearAllData() {
    if (allData.length === 0) {
        return;
    }

    if (confirm('确定要清空所有数据吗？此操作不可撤销！')) {
        allData = [];
        columnsSet.clear();
        table.clearData();
        table.setColumns([]);
        updateStatusBar();

        document.getElementById('fileInfo').innerHTML =
            '<h4>📄 文件信息</h4><p>等待文件上传...</p>';
    }
}

// 更新状态栏
function updateStatusBar() {
    console.log('allData', allData)
    document.getElementById('rowCount').textContent = allData.length;
    updateSelectedCount();
}

// 更新选中行计数
function updateSelectedCount() {
    const selectedCount = table.getSelectedRows().length;
    document.getElementById('selectedCount').textContent = selectedCount;
}

// 上传数据
function uploadFormData() {
    if (allData.length === 0) {
        alert('没有数据可上传！');
        return;
    }

    // 获取文件名
    const name = formFileNameInput.value || formFileNameInput.placeholder || 'autofilename';

    // 准备上传的数据
    const uploadData = {
        filename: name,
        timestamp: new Date().toISOString(),
        totalRows: allData.length,
        data: allData
    };

    // 创建 FormData 对象
    const formData = new FormData();
    formData.append('data', JSON.stringify(uploadData));
    formData.append('filename', name);
    formData.append('timestamp', new Date().toISOString());

    // 模拟文件上传（类似于文件选择）
    const blob = new Blob([JSON.stringify(uploadData, null, 2)], {
        type: 'application/json'
    });

    // 创建 File 对象（模拟文件）
    const jsonFile = new File([blob], `${name}.json`, {
        type: 'application/json',
        lastModified: Date.now()
    });

    // 创建模拟的 files 数组
    const files = [jsonFile];

    console.log(files)

    // 调用你的上传函数
    uploadFiles(files);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    initTable();
    initDragDrop();

    // 添加一些样式图标
    const style = document.createElement('style');
    style.textContent = `
                .tabulator .tabulator-row.tabulator-selectable:hover {
                    background-color: #e3f2fd !important;
                }
                .tabulator .tabulator-cell[title] {
                    white-space: pre-wrap;
                }
            `;
    document.head.appendChild(style);
});