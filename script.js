const fileInput = document.getElementById('fileInput');
const displayImage = document.getElementById('displayImage');
const imageContainer = document.getElementById('imageContainer');
const uploadArea = document.getElementById('uploadArea');
const imageInfo = document.getElementById('imageInfo');

document.getElementById('chooseFileButton').addEventListener('click', () => fileInput.click());
document.getElementById('clearImageButton').addEventListener('click', clearImage);
document.getElementById('exportImageButton').addEventListener('click', exportImage);
document.getElementById('limitFileSize').addEventListener('change', toggleFileSizeLimit);
document.getElementById('borderWidth').addEventListener('input', throttledApplyBorder);
document.getElementById('backgroundType').addEventListener('change', toggleBackgroundType);
document.getElementById('customBackgroundColor').addEventListener('change', applyBorderFast);
document.getElementById('aspectRatio').addEventListener('change', toggleCustomAspectRatio);
document.getElementById('applyAspectRatioButton').addEventListener('click', applyAspectRatio);

// File input change event
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        loadImage(file);
    }
});

// Drag and drop functionality
uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    uploadArea.style.background = '#444';
});

uploadArea.addEventListener('dragleave', function(e) {
    uploadArea.style.background = '';
});

uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadArea.style.background = '';
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') ||
                file.name.toLowerCase().endsWith('.tif') ||
                file.name.toLowerCase().endsWith('.tiff'))) {
        loadImage(file);
    }
});

// Click to upload
uploadArea.addEventListener('click', function() {
    fileInput.click();
});

function loadImage(file) {
    // Check if it's a TIFF file
    const isTiff = file.type === 'image/tiff' || file.type === 'image/tif' ||
                  file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');

    if (isTiff) {
        loadTiffImage(file);
    } else {
        loadRegularImage(file);
    }
}

async function loadTiffImage(file) {
    try {
        // Check if GeoTIFF is loaded
        if (typeof GeoTIFF === 'undefined') {
            alert('TIFF support not available. Please try converting to PNG first.');
            return;
        }

        // Read file as array buffer
        const arrayBuffer = await file.arrayBuffer();

        // Parse TIFF using GeoTIFF
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();

        // Get image dimensions
        const width = image.getWidth();
        const height = image.getHeight();

        // Read raster data
        const rasters = await image.readRasters();

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        // Create ImageData
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        // Convert raster data to RGBA
        const samples = image.getSamplesPerPixel();

        if (samples >= 3) {
            // RGB or RGBA
            for (let i = 0; i < width * height; i++) {
                data[i * 4] = rasters[0][i];     // R
                data[i * 4 + 1] = rasters[1][i]; // G
                data[i * 4 + 2] = rasters[2][i]; // B
                data[i * 4 + 3] = samples >= 4 ? rasters[3][i] : 255; // A
            }
        } else {
            // Grayscale
            for (let i = 0; i < width * height; i++) {
                const gray = rasters[0][i];
                data[i * 4] = gray;     // R
                data[i * 4 + 1] = gray; // G
                data[i * 4 + 2] = gray; // B
                data[i * 4 + 3] = 255;  // A
            }
        }

        // Draw to canvas
        ctx.putImageData(imageData, 0, 0);

        // Convert canvas to data URL and load into image
        const dataURL = canvas.toDataURL('image/png');
        displayImage.src = dataURL;
        displayImage.style.display = 'block';
        uploadArea.style.display = 'none';
        imageContainer.classList.add('has-image');

        // Show image info
        displayImage.onload = function() {
            setupImageDisplay(file);
        };

    } catch (error) {
        alert('Error loading TIFF file: ' + error.message + '\nPlease try converting the TIFF to PNG first.');
        console.error('TIFF loading error:', error);
    }
}

function loadRegularImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        displayImage.src = e.target.result;
        displayImage.style.display = 'block';
        uploadArea.style.display = 'none';
        imageContainer.classList.add('has-image');

        // Show image info
        displayImage.onload = function() {
            setupImageDisplay(file);
        };
    };
    reader.readAsDataURL(file);
}

function setupImageDisplay(file) {
    // Reset aspect ratio borders for new image
    displayImage.aspectBorderLeft = 0;
    displayImage.aspectBorderRight = 0;
    displayImage.aspectBorderTop = 0;
    displayImage.aspectBorderBottom = 0;
    displayImage.aspectRatioX = null;
    displayImage.aspectRatioY = null;

    // Cache values for performance
    originalPixels = displayImage.naturalWidth * displayImage.naturalHeight;
    originalFileSize = file.size;
    originalFileName = file.name;
    originalFileType = file.type;
    dimensionsInfo = document.getElementById('dimensionsInfo');

    // Set up blur background when image loads
    const blurBackground = document.getElementById('blurBackground');
    blurBackground.style.backgroundImage = `url(${displayImage.src})`;
    blurBackgroundReady = true;

    const mb = (file.size / 1024 / 1024).toFixed(2);
    imageInfo.innerHTML = `
        <strong>${file.name}</strong><br>
        ${displayImage.naturalWidth} × ${displayImage.naturalHeight}px<br>
        ${mb} MB
    `;
    imageInfo.style.display = 'block';
    dimensionsInfo.style.display = 'block';
    document.getElementById('aspectRatio').value = '4:5';
    applyAspectRatio();

    // Reset export settings
    document.getElementById('limitFileSize').checked = false;
    document.getElementById('maxFileSizeMB').disabled = true;
    document.getElementById('maxFileSizeMB').value = 1;
}

function clearImage() {
    // Clear image display
    displayImage.style.display = 'none';
    displayImage.src = '';
    displayImage.removeAttribute('src');

    // Reset UI
    uploadArea.style.display = 'block';
    imageContainer.classList.remove('has-image');
    imageInfo.style.display = 'none';
    document.getElementById('dimensionsInfo').style.display = 'none';

    // Reset file input
    fileInput.value = '';

    // Reset border controls
    document.getElementById('borderWidth').value = 50;
    document.getElementById('borderWidthValue').textContent = '50';
    document.getElementById('backgroundType').value = '#ffffff';
    document.getElementById('customBackgroundColor').value = '#ffffff';
    document.getElementById('aspectRatio').value = '4:5';

    // Clear blur background
    const blurBackground = document.getElementById('blurBackground');
    blurBackground.classList.remove('active');
    blurBackground.style.backgroundImage = '';
    blurBackground.style.transform = '';

    toggleBackgroundType();

    // Clear cached values
    originalPixels = null;
    originalFileSize = null;
    originalFileName = null;
    originalFileType = null;
    dimensionsInfo = null;
    blurBackgroundReady = false;

    // Clear aspect ratio borders
    displayImage.aspectBorderLeft = 0;
    displayImage.aspectBorderRight = 0;
    displayImage.aspectBorderTop = 0;
    displayImage.aspectBorderBottom = 0;
    displayImage.aspectRatioX = null;
    displayImage.aspectRatioY = null;
}

// Cache DOM elements and calculations for better performance
let dimensionsInfo, originalPixels, originalFileSize, originalFileName, originalFileType, blurBackgroundReady = false;

// Throttle border updates for smoother slider performance
let borderUpdateTimeout;
function throttledApplyBorder() {
    // Update the display value immediately for responsive feedback
    const borderPercent = document.getElementById('borderWidth').value;
    document.getElementById('borderWidthValue').textContent = borderPercent;

    // Throttle the actual border application
    clearTimeout(borderUpdateTimeout);
    borderUpdateTimeout = setTimeout(() => {
        applyBorderFast();
    }, 3); // ~60fps
}

function getBackgroundColor() {
    const backgroundType = document.getElementById('backgroundType').value;

    if (backgroundType === 'custom') {
        return document.getElementById('customBackgroundColor').value;
    } else {
        return backgroundType; // Will be hex color or 'blur'
    }
}

function toggleBackgroundType() {
    const backgroundType = document.getElementById('backgroundType').value;
    const customColorPicker = document.getElementById('customBackgroundColor');
    const blurBackground = document.getElementById('blurBackground');

    if (backgroundType === 'custom') {
        customColorPicker.style.display = 'inline-block';
    } else {
        customColorPicker.style.display = 'none';
    }

    if (backgroundType === 'blur') {
        blurBackground.classList.add('active');
    } else {
        blurBackground.classList.remove('active');
    }

    // Apply border with new background type
    if (displayImage.src) {
        applyBorderFast();
    }
}

function toggleFileSizeLimit() {
    const limitCheckbox = document.getElementById('limitFileSize');
    const fileSizeInput = document.getElementById('maxFileSizeMB');

    if (limitCheckbox.checked) {
        fileSizeInput.disabled = false;
    } else {
        fileSizeInput.disabled = true;
    }
}

function applyBorderFast() {
    const borderPercent = document.getElementById('borderWidth').value;

    // Update display value
    document.getElementById('borderWidthValue').textContent = borderPercent;

    if (displayImage.src) {
        // Calculate border width so that 100% = image width doubles
        // At 100%, border should be 50% of original width on each side
        const borderWidthPx = (borderPercent / 100) * displayImage.naturalWidth * .5;
        const backgroundType = document.getElementById('backgroundType').value;

        // Get stored aspect ratio border values or default to 0
        const aspectLeft = displayImage.aspectBorderLeft || 0;
        const aspectRight = displayImage.aspectBorderRight || 0;
        const aspectTop = displayImage.aspectBorderTop || 0;
        const aspectBottom = displayImage.aspectBorderBottom || 0;

        // Check if we have stored aspect ratio values
        const hasAspectRatio = displayImage.aspectRatioX && displayImage.aspectRatioY;



        let finalBorderLeft, finalBorderRight, finalBorderTop, finalBorderBottom;

        if (hasAspectRatio) {
            // Use stored aspect ratio to maintain proportions when adding border
            const ratioX = displayImage.aspectRatioX;
            const ratioY = displayImage.aspectRatioY;

            // Determine which dimension is shorter in the aspect ratio
            const isXShorter = ratioX <= ratioY;

            if (isXShorter) {
                // X is shorter, add borderWidthPx to X and calculate proportional Y
                const additionalY = borderWidthPx * (ratioY / ratioX);

                finalBorderLeft = aspectLeft + borderWidthPx / 2;
                finalBorderRight = aspectRight + borderWidthPx / 2;
                finalBorderTop = aspectTop + additionalY / 2;
                finalBorderBottom = aspectBottom + additionalY / 2;
            } else {
                // Y is shorter, add borderWidthPx to Y and calculate proportional X
                const additionalX = borderWidthPx * (ratioX / ratioY);

                finalBorderLeft = aspectLeft + additionalX / 2;
                finalBorderRight = aspectRight + additionalX / 2;
                finalBorderTop = aspectTop + borderWidthPx / 2;
                finalBorderBottom = aspectBottom + borderWidthPx / 2;
            }
        } else {
            // No aspect ratio, use uniform border
            finalBorderLeft = borderWidthPx;
            finalBorderRight = borderWidthPx;
            finalBorderTop = borderWidthPx;
            finalBorderBottom = borderWidthPx;
        }

        finalBorderLeft = Math.round(finalBorderLeft);
        finalBorderRight = Math.round(finalBorderRight);
        finalBorderTop = Math.round(finalBorderTop);
        finalBorderBottom = Math.round(finalBorderBottom);

        // Calculate total dimensions for proper scaling
        const totalWidth = displayImage.naturalWidth + finalBorderLeft + finalBorderRight;
        const totalHeight = displayImage.naturalHeight + finalBorderTop + finalBorderBottom;

        // Only scale if the image with borders exceeds the viewport
        const container = imageContainer;
        const containerMaxWidth = container.clientWidth * 0.9;
        const containerMaxHeight = container.clientHeight * 0.9;

        const scaleToFit = Math.min(1, Math.min(containerMaxWidth / totalWidth, containerMaxHeight / totalHeight));



        // Apply the borders and scaling
        const backgroundColor = getBackgroundColor();
        if (backgroundColor !== 'blur') {
            displayImage.style.borderLeft = `${Math.round(finalBorderLeft * scaleToFit)}px solid ${backgroundColor}`;
            displayImage.style.borderRight = `${Math.round(finalBorderRight * scaleToFit)}px solid ${backgroundColor}`;
            displayImage.style.borderTop = `${Math.round(finalBorderTop * scaleToFit)}px solid ${backgroundColor}`;
            displayImage.style.borderBottom = `${Math.round(finalBorderBottom * scaleToFit)}px solid ${backgroundColor}`;
            displayImage.style.boxShadow = 'none';
        } else {
            // Use blur background
            displayImage.style.borderLeft = `${Math.round(finalBorderLeft * scaleToFit)}px solid transparent`;
            displayImage.style.borderRight = `${Math.round(finalBorderRight * scaleToFit)}px solid transparent`;
            displayImage.style.borderTop = `${Math.round(finalBorderTop * scaleToFit)}px solid transparent`;
            displayImage.style.borderBottom = `${Math.round(finalBorderBottom * scaleToFit)}px solid transparent`;
            displayImage.style.boxShadow = 'none';

            // Just adjust blur background positioning (already set up in loadImage)
            const blurBackground = document.getElementById('blurBackground');
            blurBackground.classList.add('active');

            // Adjust blur background scale to account for total border
            const maxBorderX = Math.max(finalBorderLeft, finalBorderRight);
            const maxBorderY = Math.max(finalBorderTop, finalBorderBottom);
            const scaleX = (displayImage.naturalWidth + maxBorderX * 2) / displayImage.naturalWidth;
            const scaleY = (displayImage.naturalHeight + maxBorderY * 2) / displayImage.naturalHeight;
            blurBackground.style.transform = `scale(${Math.max(scaleX, scaleY)})`;
        }

        // Update dimensions in real-time with cached values using actual final border values
        if (originalPixels && originalFileSize) {
            const totalWidth = displayImage.naturalWidth + finalBorderLeft + finalBorderRight;
            const totalHeight = displayImage.naturalHeight + finalBorderTop + finalBorderBottom;
            const newPixels = totalWidth * totalHeight;
            const pixelRatio = newPixels / originalPixels;
            const estimatedSize = (originalFileSize * pixelRatio / 1024 / 1024).toFixed(2);

            dimensionsInfo.innerHTML = `
                <strong>With Border:</strong><br>

                ${Math.round(totalWidth)} × ${Math.round(totalHeight)}px<br>
                ${estimatedSize} MB
            `;
        }
    }
}

function updateDimensions() {
    applyBorderFast();
}

function toggleCustomAspectRatio() {
    const aspectRatio = document.getElementById('aspectRatio').value;
    const customGroup = document.getElementById('customAspectGroup');

    if (aspectRatio === 'custom') {
        customGroup.style.display = 'block';
    } else {
        customGroup.style.display = 'none';
        // Apply the selected preset ratio immediately
        if (displayImage.src) {
            setTimeout(() => applyAspectRatio(), 0);
        }
    }
}

function applyAspectRatio() {
    const aspectRatio = document.getElementById('aspectRatio').value;

    if (!displayImage.src) {
        return; // No image loaded
    }

    const width = displayImage.naturalWidth;
    const height = displayImage.naturalHeight;

    // Calculate new dimensions based on aspect ratio
    let newWidth = width;
    let newHeight = height;
    let ratioX, ratioY;

    if (aspectRatio === 'original') {
        newWidth = width;
        newHeight = height;
    } else if (aspectRatio === 'custom') {
        // Get custom ratio values
        ratioX = parseFloat(document.getElementById('customRatioX').value);
        ratioY = parseFloat(document.getElementById('customRatioY').value);

        if (!ratioX || !ratioY || ratioX <= 0 || ratioY <= 0) {
            alert('Please enter valid positive numbers for the custom aspect ratio.');
            return;
        }
    } else {
        // Parse preset ratio
        [ratioX, ratioY] = aspectRatio.split(':').map(Number);
    }

    if (aspectRatio !== 'original') {
        if (!isNaN(ratioX) && !isNaN(ratioY) && ratioX > 0 && ratioY > 0) {
            // Calculate based on width
            let calcHeight = Math.round(width * (ratioY / ratioX));
            // Calculate based on height
            let calcWidth = Math.round(height * (ratioX / ratioY));

            // Choose the one that is greater than or equal to original dimensions
            if (calcHeight >= height && width >= width) {
                newWidth = width;
                newHeight = calcHeight;
            } else if (calcWidth >= width && height >= height) {
                newWidth = calcWidth;
                newHeight = height;
            }
        }
    }

    // Store aspect ratio border values for applyBorderFast to use
    const widthDiff = newWidth - width;
    const heightDiff = newHeight - height;

    if (aspectRatio === 'original') {
        // Reset everything for original
        displayImage.aspectBorderLeft = 0;
        displayImage.aspectBorderRight = 0;
        displayImage.aspectBorderTop = 0;
        displayImage.aspectBorderBottom = 0;
        displayImage.aspectRatioX = null;
        displayImage.aspectRatioY = null;
    } else {
        // Store the aspect ratio borders separately
        displayImage.aspectBorderLeft = widthDiff / 2;
        displayImage.aspectBorderRight = widthDiff / 2;
        displayImage.aspectBorderTop = heightDiff / 2;
        displayImage.aspectBorderBottom = heightDiff / 2;
        // Store the actual aspect ratio values for reuse
        displayImage.aspectRatioX = ratioX;
        displayImage.aspectRatioY = ratioY;
    }

    // Apply borders through applyBorderFast
    applyBorderFast();
    applyBorderFast();

    // Force a DOM refresh to ensure visual update
    displayImage.offsetHeight;


}

function exportImage() {
    if (!displayImage.src) {
        alert('Please load an image first');
        return;
    }

    // Show loading state
    const exportBtn = document.getElementById('exportImageButton');
    const originalText = exportBtn.textContent;
    const originalCursor = document.body.style.cursor;

    exportBtn.textContent = 'Exporting...';
    exportBtn.disabled = true;
    document.body.style.cursor = 'wait';

    // Use setTimeout to allow UI to update before heavy processing
    setTimeout(() => {
        try {
            const borderPercent = document.getElementById('borderWidth').value;
            const borderWidthPx = (borderPercent / 100) * displayImage.naturalWidth * 0.5;

            // Get stored aspect ratio border values or default to 0 (same as preview)
            const aspectLeft = displayImage.aspectBorderLeft || 0;
            const aspectRight = displayImage.aspectBorderRight || 0;
            const aspectTop = displayImage.aspectBorderTop || 0;
            const aspectBottom = displayImage.aspectBorderBottom || 0;

            // Check if we have stored aspect ratio values
            const hasAspectRatio = displayImage.aspectRatioX && displayImage.aspectRatioY;

            let finalBorderLeft, finalBorderRight, finalBorderTop, finalBorderBottom;

            if (hasAspectRatio) {
                // Use the same logic as applyBorderFast for consistency
                const ratioX = displayImage.aspectRatioX;
                const ratioY = displayImage.aspectRatioY;

                // Determine which dimension is shorter in the aspect ratio
                const isXShorter = ratioX <= ratioY;

                if (isXShorter) {
                    // X is shorter, add borderWidthPx to X and calculate proportional Y
                    const additionalY = borderWidthPx * (ratioY / ratioX);

                    finalBorderLeft = aspectLeft + borderWidthPx / 2;
                    finalBorderRight = aspectRight + borderWidthPx / 2;
                    finalBorderTop = aspectTop + additionalY / 2;
                    finalBorderBottom = aspectBottom + additionalY / 2;
                } else {
                    // Y is shorter, add borderWidthPx to Y and calculate proportional X
                    const additionalX = borderWidthPx * (ratioX / ratioY);

                    finalBorderLeft = aspectLeft + additionalX / 2;
                    finalBorderRight = aspectRight + additionalX / 2;
                    finalBorderTop = aspectTop + borderWidthPx / 2;
                    finalBorderBottom = aspectBottom + borderWidthPx / 2;
                }
            } else {
                // No aspect ratio, use uniform border
                finalBorderLeft = borderWidthPx;
                finalBorderRight = borderWidthPx;
                finalBorderTop = borderWidthPx;
                finalBorderBottom = borderWidthPx;
            }

            // Create canvas with border at full resolution
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set canvas size to include border
            const totalWidth = displayImage.naturalWidth + finalBorderLeft + finalBorderRight;
            const totalHeight = displayImage.naturalHeight + finalBorderTop + finalBorderBottom;
            canvas.width = totalWidth;
            canvas.height = totalHeight;

            const backgroundColor = getBackgroundColor();

            if (backgroundColor !== 'blur') {
                // Fill with solid color
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, totalWidth, totalHeight);
            } else {
                // Create blur background - draw the image larger and blurred first
                ctx.filter = 'blur(20px)';
                // Draw background image scaled to cover entire canvas
                const bgScale = Math.max(totalWidth / displayImage.naturalWidth, totalHeight / displayImage.naturalHeight);
                const bgWidth = displayImage.naturalWidth * bgScale;
                const bgHeight = displayImage.naturalHeight * bgScale;
                const bgX = (totalWidth - bgWidth) / 2;
                const bgY = (totalHeight - bgHeight) / 2;
                ctx.drawImage(displayImage, bgX, bgY, bgWidth, bgHeight);
                ctx.filter = 'none';
            }

            // Draw image centered with proper border positioning
            ctx.drawImage(displayImage, Math.floor(finalBorderLeft), Math.floor(finalBorderTop));

            // Check if file size limit is enabled
            const limitEnabled = document.getElementById('limitFileSize').checked;
            const maxFileSizeMB = parseFloat(document.getElementById('maxFileSizeMB').value);

            const mimeType = 'image/jpeg';
            let quality = 1.0; // Start with highest quality
            let dataURL;

            if (limitEnabled && maxFileSizeMB > 0) {
                // Iteratively reduce quality until file size is under limit
                const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
                let attempts = 0;
                const maxAttempts = 20;

                do {
                    dataURL = canvas.toDataURL(mimeType, quality);

                    // Calculate file size in bytes (base64 string is about 4/3 the size of binary)
                    const base64Length = dataURL.split(',')[1].length;
                    const fileSizeBytes = (base64Length * 3) / 4;

                    if (fileSizeBytes <= maxFileSizeBytes) {
                        // File size is acceptable
                        console.log(`Export successful at ${(quality * 100).toFixed(0)}% quality (${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
                        break;
                    }

                    // Reduce quality for next iteration
                    quality -= 0.05;
                    attempts++;

                } while (attempts < maxAttempts && quality > 0.05);

                if (attempts >= maxAttempts) {
                    alert(`Warning: Could not reduce file size to ${maxFileSizeMB} MB within quality limits. The exported file may be larger than requested.`);
                }

            } else {
                // No file size limit, use maximum quality
                dataURL = canvas.toDataURL(mimeType, quality);
                console.log('Export at 100% quality (no size limit)');
            }

            // Generate filename with JPG extension
            let filename = 'image-with-border';
            if (originalFileName) {
                const nameWithoutExt = originalFileName.replace(/\.[^/.]+$/, "");
                filename = `${nameWithoutExt}-with-border.jpg`;
            } else {
                filename = `${filename}.jpg`;
            }

            const a = document.createElement('a');
            a.href = dataURL;
            a.download = filename;
            a.click();

        } finally {
            // Reset UI state
            exportBtn.textContent = originalText;
            exportBtn.disabled = false;
            document.body.style.cursor = originalCursor;
        }
    }, 10);
}
