const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.log("🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟");
console.log("✨ Công cụ dọn dẹp tài nguyên Cocos Creator ✨\n");
console.log("📱 Liên hệ: @kyotheone \n");
console.log("🚀 Tự động lọc và xóa các tài nguyên không cần thiết!");
console.log("💾 Tiết kiệm dung lượng và tối ưu hóa dự án của bạn! 💡");
console.log("🎯 Let's get started! 😎💻");
console.log("🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟\n");

// Tạo giao diện nhập liệu từ console
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('📁 Nhập đường dẫn đến thư mục dự án: ', (inputPath) => {
    const assetsFolder = path.resolve(inputPath, 'assets/');
    let totalFilesDeleted = 0;
    let totalSizeSaved = 0;
    const usedUUIDs = new Set();
    const unusedItems = [];

    // Hàm tính kích thước của file
    const getFileSize = (filePath) => {
        const stats = fs.statSync(filePath);
        return stats.size;
    };

    // Bước 1: Tìm tất cả file .fire và .prefab, lấy UUIDs đang sử dụng
    const findFiles = (folder, fileTypes) => {
        let foundFiles = [];
        const files = fs.readdirSync(folder, { withFileTypes: true });
        files.forEach(file => {
            const filePath = path.join(folder, file.name);
            if (file.isDirectory()) {
                foundFiles = foundFiles.concat(findFiles(filePath, fileTypes));
            } else if (file.isFile() && fileTypes.includes(path.extname(file.name))) {
                foundFiles.push(filePath);
            }
        });
        return foundFiles;
    };

    // Hàm đệ quy tìm UUID trong đối tượng
    const findUUIDsInObject = (obj) => {
        if (!obj || typeof obj !== 'object') return;

        // Nếu là một đối tượng chứa __uuid__
        if (obj.__uuid__) {
            usedUUIDs.add(obj.__uuid__);
        }

        // Nếu là một mảng, duyệt qua từng phần tử trong mảng
        if (Array.isArray(obj)) {
            obj.forEach(item => findUUIDsInObject(item));
        } else {
            // Nếu là đối tượng thông thường, duyệt qua từng thuộc tính
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    findUUIDsInObject(obj[key]);
                }
            }
        }
    };

    // Xử lý file .fire và .prefab để lấy UUIDs
    const processFile = (filePath) => {
        console.log("Đang xử lý: " + filePath);
        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        fileData.forEach(element => {
            // Duyệt qua từng đối tượng element để tìm UUIDs
            findUUIDsInObject(element);

            // Xử lý riêng sp.Skeleton và cc.Label để tìm các texture và font liên quan
            if (element.__type__ === 'sp.Skeleton' && element._N$skeletonData) {
                usedUUIDs.add(element._N$skeletonData.__uuid__);  // Thêm UUID của SkeletonData

                // Tìm các file texture liên quan từ SkeletonData
                const skeletonFilePath = findMetaFileInAssets(assetsFolder, element._N$skeletonData.__uuid__);
                if (skeletonFilePath) {
                    const skeletonMetaData = JSON.parse(fs.readFileSync(skeletonFilePath, 'utf8'));
                    if (skeletonMetaData.textures) {
                        skeletonMetaData.textures.forEach(textureUuid => {
                            usedUUIDs.add(textureUuid);  // Thêm UUID của texture từ Skeleton
                        });
                    }
                }
            }

            if (element.__type__ === 'cc.Label' && element._N$file) {
                usedUUIDs.add(element._N$file.__uuid__);  // Thêm UUID của font (Label)

                // Tìm các file texture liên quan từ Label
                const labelFilePath = findMetaFileInAssets(assetsFolder, element._N$file.__uuid__);
                if (labelFilePath) {
                    const labelMetaData = JSON.parse(fs.readFileSync(labelFilePath, 'utf8'));
                    if (labelMetaData.textureUuid) {
                        usedUUIDs.add(labelMetaData.textureUuid);  // Thêm UUID của texture từ Label
                    }
                }
            }
        });
    };

    // Hàm tìm file meta trong thư mục assets
    const findMetaFileInAssets = (folder, uuid) => {
        const files = fs.readdirSync(folder, { withFileTypes: true });
        for (let file of files) {
            const filePath = path.join(folder, file.name);
            if (file.isDirectory()) {
                const result = findMetaFileInAssets(filePath, uuid);
                if (result) return result;
            } else if (file.isFile() && file.name.endsWith('.meta')) {
                const metaData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (metaData.uuid === uuid) {
                    return filePath;
                }
            }
        }
        return null;  // Không tìm thấy file
    };

    // Bước 2, 3, 4, 5: Tìm các file không sử dụng (ttf, fnt, json, png)
    const processMetaFiles = (folder, extensions, callback) => {
        const files = fs.readdirSync(folder, { withFileTypes: true });
        files.forEach(file => {
            const filePath = path.join(folder, file.name);
            if (file.isDirectory()) {
                processMetaFiles(filePath, extensions, callback);
            } else if (file.isFile() && extensions.some(ext => filePath.endsWith(ext))) {
                const metaData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                // Chỉ xử lý file nếu UUID không có trong danh sách usedUUIDs
                if (!usedUUIDs.has(metaData.uuid)) {
                    console.log("Tệp tin không sử dụng: " + filePath);
                    callback(filePath, metaData);
                }
            }
        });
    };

    // Bước 6: Xóa các file không sử dụng
    const deleteUnusedFiles = () => {
        unusedItems.forEach(item => {
            // Xóa các file meta và file chính
            item.files.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    const fileSize = getFileSize(filePath);
                    totalSizeSaved += fileSize;
                    totalFilesDeleted += 1;
                    fs.unlinkSync(filePath);
                    console.log(`✅ Đã xóa: ${filePath}`);
                }
            });
        });
    };

    // Hàm kiểm tra thư mục có rỗng không và xóa nếu rỗng
    const removeEmptyDirectories = (folder) => {
        // Đọc nội dung thư mục
        const files = fs.readdirSync(folder, { withFileTypes: true });

        // Duyệt qua tất cả các tệp và thư mục con
        for (const file of files) {
            const filePath = path.join(folder, file.name);

            if (file.isDirectory()) {
                // Đệ quy kiểm tra các thư mục con
                removeEmptyDirectories(filePath);
            }
        }

        // Kiểm tra nếu thư mục rỗng thì xóa nó
        const isEmpty = fs.readdirSync(folder).length === 0;
        if (isEmpty) {
            fs.rmdirSync(folder);
            console.log(`Đã xóa thư mục rỗng: ${folder}`);
        }
    };

    // Tính phần trăm giảm dung lượng
    const getDirectorySize = (folder) => {
        let totalSize = 0;
        const files = fs.readdirSync(folder, { withFileTypes: true });
        files.forEach(file => {
            const filePath = path.join(folder, file.name);
            if (file.isDirectory()) {
                totalSize += getDirectorySize(filePath);
            } else if (file.isFile()) {
                totalSize += getFileSize(filePath);
            }
        });
        return totalSize;
    };

    // Lấy dung lượng trước khi xóa
    const initialSize = getDirectorySize(assetsFolder);

    // Bước 1: Tìm tất cả các file .fire và .prefab
    const allFireAndPrefabFiles = findFiles(assetsFolder, ['.fire', '.prefab']);
    allFireAndPrefabFiles.forEach(file => processFile(file));

    // Bước 2: Lọc font thừa (tìm các file .ttf.meta)
    processMetaFiles(assetsFolder, ['.ttf.meta'], (filePath, metaData) => {
        if (filePath.endsWith('.ttf.meta')) {
            unusedItems.push({ type: 'Font', uuid: metaData.uuid, files: [filePath.replace('.meta', ''), filePath] });
        }
    });

    // Bước 3: Lọc bitmap font thừa (tìm các file .fnt.meta)
    processMetaFiles(assetsFolder, ['.fnt.meta'], (filePath, metaData) => {
        if (filePath.endsWith('.fnt.meta')) {
            const folderPath = path.dirname(filePath);
            const baseName = path.basename(filePath, '.fnt.meta');  // Lấy tên file mà không có phần mở rộng
            const textureMetaPath = path.join(folderPath, `${baseName}.png.meta`);
            if (fs.existsSync(textureMetaPath)) {
                unusedItems.push({
                    type: 'BitmapFont',
                    uuid: metaData.uuid,
                    files: [filePath.replace('.meta', ''), filePath, textureMetaPath.replace('.meta', ''), textureMetaPath],
                });
            }
        }
    });

    // Bước 4: Lọc skeleton thừa (tìm các file .json.meta)
    processMetaFiles(assetsFolder, ['.json.meta'], (filePath, metaData) => {
        if (filePath.endsWith('.json.meta')) {
            const folderPath = path.dirname(filePath);
            const baseName = path.basename(filePath, '.json.meta');  // Lấy tên file mà không có phần mở rộng
            const textureMetaPath = path.join(folderPath, `${baseName}.png.meta`);
            const atlasMetaPath = path.join(folderPath, `${baseName}.atlas.meta`);
            if (fs.existsSync(textureMetaPath) && fs.existsSync(atlasMetaPath)) {
                unusedItems.push({
                    type: 'Skeleton',
                    uuid: metaData.uuid,                    
                    files: [filePath.replace('.meta', ''), filePath, textureMetaPath.replace('.meta', ''), textureMetaPath, atlasMetaPath.replace('.meta', ''), atlasMetaPath],
                });
            }
        }
    });

    // Bước 5: Lọc sprite thừa (tìm các file .png.meta)
    processMetaFiles(assetsFolder, ['.png.meta'], (filePath, metaData) => {
        if (filePath.endsWith('.png.meta')) {
            // Kiểm tra subMetas để tìm UUID của sprite-frame
            const subMetas = metaData.subMetas || {};
            let isUsed = false;
            for (const key in subMetas) {
                if (usedUUIDs.has(subMetas[key].uuid)) {
                    isUsed = true;
                    break;
                }
            }
            if (!isUsed) {
                unusedItems.push({ type: 'Sprite', uuid: metaData.uuid, files: [filePath.replace('.meta', ''), filePath] });
            }
        }
    });

    // Bước 6: Xóa các file không sử dụng
    console.log(">>>>> Tiến hành xóa các tệp tin không sử dụng!");
    deleteUnusedFiles();

    removeEmptyDirectories(assetsFolder);

    // Lấy dung lượng sau khi xóa
    const finalSize = getDirectorySize(assetsFolder);
    const sizeReduction = initialSize - finalSize;
    const percentageReduction = (sizeReduction / initialSize) * 100;

    // Thống kê kết quả
    console.log("\n✨🎉 ==================== Hoàn tất! ==================== 🎉✨");
    console.log("💾 " + `Đã dọn dẹp ${totalFilesDeleted} files.`);
    console.log("🚀 " + `Tiết kiệm được: ${(sizeReduction / (1024 * 1024)).toFixed(2)} MB.` + " 🏋️‍♂️💨");
    console.log("🔥" + `Giảm tải ${percentageReduction.toFixed(2)}%.` + " dung lượng ban đầu 😎👍");
    console.log("🌟🌟 ==================== Hẹn gặp lại! ==================== 🌟🌟\n");

    // Đóng giao diện nhập liệu
    rl.close();
});

