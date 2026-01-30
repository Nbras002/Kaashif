const express = require('express');
const multer = require('multer');
const { exiftool } = require('exiftool-vendored');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// خدمة ملفات الصور الناتجة من مجلد uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.json());
// إزالة البيانات الوصفية من الصورة
app.post('/api/remove-metadata', upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const outputName = baseName + '_no_metadata' + ext;
    const outputPath = path.join(path.dirname(filePath), outputName);
    // استخدم sharp لإزالة البيانات الوصفية
    await sharp(filePath)
      .withMetadata({}) // إزالة كل البيانات الوصفية
      .toFile(outputPath);
    // حذف الملف الأصلي بعد المعالجة
    fs.unlinkSync(filePath);
    res.json({
      success: true,
      output: outputName
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Image upload and forensic analysis endpoint
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    // 1. Extract EXIF/metadata
    let metadata = await exiftool.read(filePath);
    // Convert Buffer-like fields (EXIF, ICC_Profile, XMP) to readable strings
    const bufferFields = ['EXIF', 'ICC_Profile', 'ICCProfile', 'XMP', 'XMPToolkit', 'XMPMP', 'XMPData', 'ICC', 'ICCProfileData'];
    for (const key of Object.keys(metadata)) {
      let val = metadata[key];
      // Special handling for TRC fields (RedTRC, GreenTRC, BlueTRC)
      if (["RedTRC", "GreenTRC", "BlueTRC"].includes(key)) {
        // If exiftool returns the placeholder string, try to extract from ICC profile if available
        if (typeof val === 'string' && /\(Binary data [0-9]+ bytes, use -b option to extract\)/.test(val)) {
          try {
            const icc = (await sharp(fileBuffer).metadata()).icc;
            if (icc && Buffer.isBuffer(icc)) {
              // ICC tags are at offset 128, tag count at 128-131
              const tagCount = icc.readUInt32BE(128);
              let found = false;
              for (let i = 0; i < tagCount; i++) {
                const tagOffset = 132 + i * 12;
                const sig = icc.toString('ascii', tagOffset, tagOffset + 4);
                if ((key === 'RedTRC' && sig === 'rTRC') || (key === 'GreenTRC' && sig === 'gTRC') || (key === 'BlueTRC' && sig === 'bTRC')) {
                  const tagDataOffset = icc.readUInt32BE(tagOffset + 4);
                  const tagDataSize = icc.readUInt32BE(tagOffset + 8);
                  const buf = icc.slice(tagDataOffset, tagDataOffset + tagDataSize);
                  // ICC curveType: 4 bytes type, 4 bytes reserved, 4 bytes count
                  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'curv') {
                    const count = buf.readUInt32BE(8);
                    if (count === 1) {
                      const gamma = buf.length >= 14 ? buf.readUInt16BE(12) / 256 : null;
                      metadata[key] = gamma ? `Gamma: ${gamma}` : '[TRC: gamma, unreadable]';
                    } else {
                      let lut = [];
                      for (let j = 0; j < count; j++) {
                        const pos = 12 + j * 2;
                        if (pos + 2 <= buf.length) {
                          lut.push(buf.readUInt16BE(pos));
                        }
                      }
                      metadata[key] = `LUT: [${lut.slice(0, 16).join(', ')}${lut.length > 16 ? ', ...' : ''}] (total ${lut.length})`;
                    }
                  } else if (buf.length === 32) {
                    // Common sRGB/AdobeRGB: 32-byte LUT, 8-bit values
                    let lut = Array.from(buf).map(v => v);
                    metadata[key] = `LUT: [${lut.slice(0, 16).join(', ')}${lut.length > 16 ? ', ...' : ''}] (total ${lut.length})`;
                  } else {
                    metadata[key] = '[TRC: unknown or not curveType]';
                  }
                  found = true;
                  break;
                }
              }
              if (!found) {
                metadata[key] = '[TRC: ICC tag not found]';
              }
            } else {
              metadata[key] = '[TRC: ICC profile not available]';
            }
          } catch (e) {
            metadata[key] = '[TRC: ICC extraction error]';
          }
        }
        // If already parsed as Buffer (previous logic)
        else if (val && typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
          const buf = Buffer.from(val.data);
          if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'curv') {
            const count = buf.readUInt32BE(8);
            if (count === 1) {
              const gamma = buf.length >= 14 ? buf.readUInt16BE(12) / 256 : null;
              metadata[key] = gamma ? `Gamma: ${gamma}` : '[TRC: gamma, unreadable]';
            } else {
              let lut = [];
              for (let i = 0; i < count; i++) {
                const pos = 12 + i * 2;
                if (pos + 2 <= buf.length) {
                  lut.push(buf.readUInt16BE(pos));
                }
              }
              metadata[key] = `LUT: [${lut.slice(0, 16).join(', ')}${lut.length > 16 ? ', ...' : ''}] (total ${lut.length})`;
            }
          } else if (buf.length === 32) {
            // Common sRGB/AdobeRGB: 32-byte LUT, 8-bit values
            let lut = Array.from(buf).map(v => v);
            metadata[key] = `LUT: [${lut.slice(0, 16).join(', ')}${lut.length > 16 ? ', ...' : ''}] (total ${lut.length})`;
          } else {
            metadata[key] = '[TRC: unknown or not curveType]';
          }
        }
      }
      // Detect Node.js Buffer or Buffer-like object (default handling)
      else if (val && typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
        const buf = Buffer.from(val.data);
        let utf8 = buf.toString('utf8');
        // For XMP, EXIF, ICC: if valid XML or readable, use as string
        if (/^<\?xml/.test(utf8) || /xmpmeta|rdf:RDF|icc|profile|desc|copyright|adobe|photoshop|exif|tiff|camera|date|profile/i.test(utf8)) {
          metadata[key] = utf8;
        } else {
          // Fallback to base64 for binary
          metadata[key] = buf.toString('base64');
        }
      }
      // Some libraries may return raw binary as Uint8Array
      else if (val && typeof val === 'object' && val.constructor && val.constructor.name === 'Uint8Array') {
        const buf = Buffer.from(val);
        let utf8 = buf.toString('utf8');
        if (/^<\?xml/.test(utf8) || /xmpmeta|rdf:RDF|icc|profile|desc|copyright|adobe|photoshop|exif|tiff|camera|date|profile/i.test(utf8)) {
          metadata[key] = utf8;
        } else {
          metadata[key] = buf.toString('base64');
        }
      }
      // If field is a known binary field but not Buffer, try to stringify
      else if (bufferFields.includes(key) && typeof val !== 'string') {
        try {
          metadata[key] = String(val);
        } catch (e) {
          metadata[key] = '[unreadable binary]';
        }
      }
    }
    // 2. Basic image info
    const imageInfo = await sharp(fileBuffer).metadata();
    // --- autoOrient logic ---
    // Try to extract EXIF orientation and describe it
    let orientation = metadata.Orientation || metadata['EXIF:Orientation'] || null;
    let autoOrient = null;
    let autoOrientDescription = null;
    let autoOrientApplied = false;
    // Map EXIF orientation values to human-readable descriptions
    const orientationMap = {
      1: 'Normal (0°)',
      2: 'Mirrored horizontal',
      3: 'Rotated 180°',
      4: 'Mirrored vertical',
      5: 'Mirrored horizontal then rotated 90° CCW',
      6: 'Rotated 90° CW',
      7: 'Mirrored horizontal then rotated 90° CW',
      8: 'Rotated 90° CCW'
    };
    if (orientation) {
      // Try to parse orientation as integer
      let oriNum = parseInt(orientation, 10);
      if (!isNaN(oriNum)) {
        autoOrientDescription = orientationMap[oriNum] || `Unknown (${oriNum})`;
        autoOrientApplied = oriNum !== 1;
        autoOrient = {
          applied: autoOrientApplied,
          orientation: oriNum,
          description: autoOrientDescription
        };
      } else {
        autoOrient = {
          applied: false,
          orientation: orientation,
          description: 'Unknown orientation value'
        };
      }
    } else {
      autoOrient = {
        applied: false,
        orientation: null,
        description: 'No EXIF orientation tag found'
      };
    }
    metadata.autoOrient = autoOrient;
    // 3. OCR (text detection)
    const ocrResult = await Tesseract.recognize(fileBuffer, 'eng');
    // 4. Clean up uploaded file
    fs.unlinkSync(filePath);
    // 5. Respond with analysis
    res.json({
      metadata,
      imageInfo,
      ocr: ocrResult.data.text
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Kaashif Forensic API is running.');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
