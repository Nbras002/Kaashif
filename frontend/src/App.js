import React, { useState } from 'react';
import { Container, Typography, Box, Button, LinearProgress, Paper, TextField, CssBaseline, Divider, Card, CardContent, Collapse, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { arSD, enUS } from '@mui/material/locale';
import axios from 'axios';
import HexViewer from './HexViewer';

// Helper component for truncating and expanding long values
function MetadataCell({ k, value }) {
  const [expanded, setExpanded] = useState(false);
  // List of properties to always render as raw string or rawValue
  const rawProps = [
    'FileModifyDate', 'FileAccessDate', 'FileCreateDate', 'DateCreated', 'RegionInfo', 'ProfileDateTime',
    'RedTRC', 'BlueTRC', 'GreenTRC', 'HDRGainCurve', 'SubSecCreateDate', 'SubSecModifyDate', 'ThumbnailImage',
    'MPImage2', 'CreateDate', 'DateTimeOriginal', 'ModifyDate', 'autoOrient', 'EXIF', 'ICC', 'XMP'
  ];
  const isObj = typeof value === 'object' && value !== null;
  let str;
  if ([
    'FileModifyDate', 'FileAccessDate', 'FileCreateDate', 'DateCreated', 'RegionInfo', 'ProfileDateTime',
    'RedTRC', 'BlueTRC', 'GreenTRC', 'HDRGainCurve', 'SubSecCreateDate', 'SubSecModifyDate', 'ThumbnailImage',
    'MPImage2', 'CreateDate', 'DateTimeOriginal', 'ModifyDate', 'EXIF', 'ICC', 'XMP', 'SubSecDateTimeOriginal'
  ].includes(k)) {
    if (value && typeof value === 'object' && value.rawValue !== undefined) {
      str = String(value.rawValue);
    } else {
      str = isObj ? JSON.stringify(value, null, 2) : String(value);
    }
  } else if (k === 'autoOrient') {
    // Render autoOrient as a readable string: Yes/No, orientation, description
    if (value && typeof value === 'object') {
      const applied = value.applied ? 'Yes' : 'No';
      const orientation = value.orientation !== undefined && value.orientation !== null ? value.orientation : 'N/A';
      const desc = value.description || '';
      str = `Applied: ${applied}\nOrientation: ${orientation}\n${desc}`;
    } else {
      str = String(value);
    }
  } else {
    str = isObj ? JSON.stringify(value, null, 2) : String(value);
  }
  const isLong = str.length > 200 || /<\?xml|profile|xmpmeta|ICC|Exif/i.test(str);
  const isXml = /<\?xml|xmpmeta|rdf:RDF/i.test(str);
  return (
    <tr>
      <td style={{ border: '1px solid #ccc', padding: 4, fontWeight: 500 }}>{k}</td>
      <td style={{ border: '1px solid #ccc', padding: 4, maxWidth: 500, wordBreak: 'break-all' }}>
        {isLong ? (
          <>
            <Box display="flex" alignItems="center">
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                <ExpandMoreIcon style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </IconButton>
              <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                {expanded ? (isXml ? 'Hide XML' : 'Hide Data') : (isXml ? 'Show XML' : 'Show More')}
              </Typography>
            </Box>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Paper variant="outlined" sx={{ mt: 1, p: 1, background: '#f8f8f8', maxHeight: 300, overflow: 'auto' }}>
                <pre style={{ margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: isXml ? '#1565c0' : undefined }}>{str}</pre>
              </Paper>
            </Collapse>
            {!expanded && <Typography variant="caption">{str.slice(0, 120)}...</Typography>}
          </>
        ) : (
          <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', display: 'inline' }}>{str}</pre>
        )}
      </td>
    </tr>
  );
}


function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('en');
  const [hexOpen, setHexOpen] = useState(false);
  const [hexData, setHexData] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState('');

  const theme = createTheme({
    direction: lang === 'ar' ? 'rtl' : 'ltr',
  }, lang === 'ar' ? arSD : enUS);

  const labels = {
    en: {
      title: 'Kaashif Digital Forensics',
      selectImage: 'Select Image',
      selectedFile: 'Selected File',
      analyze: 'Analyze',
      report: 'Forensic Analysis Report',
      summary: 'Executive Summary',
      summaryText: 'This report provides a technical and contextual forensic analysis of the submitted image. All findings are evidence-based and confidence levels are indicated for each section.',
      techForensics: '1. Technical Forensics',
      extractedMeta: 'Extracted Metadata & EXIF',
      imageProps: 'Image Properties',
      visualAnalysis: '2. Visual Content Analysis',
      detectedText: 'Detected Text (OCR)',
      noText: 'No text detected.',
      obs: '3. Observations & Insights',
      obsList: [
        'All metadata and image properties are extracted directly from the file (high confidence).',
        'Text detection is performed using OCR; accuracy depends on image quality and content.',
        'Further analysis (manipulation, geolocation, advanced content) can be integrated as needed.'
      ],
      confidence: '4. Confidence Levels',
      section: 'Section',
      conf: 'Confidence',
      metaConf: 'Metadata & EXIF',
      imgConf: 'Image Properties',
      ocrConf: 'Text Detection (OCR)',
      high: 'High',
      medium: 'Medium',
      langSwitch: 'العربية'
    },
    ar: {
      title: 'كاشف للتحليل الجنائي الرقمي',
      selectImage: 'اختر صورة',
      selectedFile: 'الملف المختار',
      analyze: 'تحليل',
      report: 'تقرير التحليل الجنائي',
      summary: 'الملخص التنفيذي',
      summaryText: 'يقدم هذا التقرير تحليلاً جنائياً فنياً وسياقياً للصورة المقدمة. جميع النتائج مبنية على الأدلة مع توضيح مستوى الثقة لكل قسم.',
      techForensics: '١. التحليل الفني',
      extractedMeta: 'البيانات الوصفية المستخرجة',
      imageProps: 'خصائص الصورة',
      visualAnalysis: '٢. تحليل المحتوى البصري',
      detectedText: 'النص المكتشف (OCR)',
      noText: 'لم يتم اكتشاف نص.',
      obs: '٣. الملاحظات والاستنتاجات',
      obsList: [
        'تم استخراج جميع البيانات الوصفية وخصائص الصورة مباشرة من الملف (ثقة عالية).',
        'تم اكتشاف النص باستخدام التعرف الضوئي على الحروف؛ الدقة تعتمد على جودة الصورة والمحتوى.',
        'يمكن دمج تحليلات إضافية (التلاعب، تحديد الموقع، محتوى متقدم) عند الحاجة.'
      ],
      confidence: '٤. مستويات الثقة',
      section: 'القسم',
      conf: 'الثقة',
      metaConf: 'البيانات الوصفية',
      imgConf: 'خصائص الصورة',
      ocrConf: 'اكتشاف النص (OCR)',
      high: 'عالية',
      medium: 'متوسطة',
      langSwitch: 'English'
    }
  };
  const t = labels[lang];

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
    setError('');
    setHexData(null);
  };
  // Helper to extract hex, offsets, and decoded text from file
  const extractHexData = async (file) => {
    if (!file) return null;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let hexRows = [];
    let text = '';
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = Array.from(chunk).map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
      hexRows.push({ offset: '0x' + i.toString(16).padStart(8, '0'), hex, text: ascii });
      text += ascii;
    }
    return { hexRows, decodedText: text };
  };

  // Render hex view as HTML for new tab
  const renderHexHtml = (hexData) => {
    if (!hexData) return '';
    return `<!DOCTYPE html><html><head><title>Hex Viewer</title><meta charset="utf-8" />
      <style>
        body { font-family: monospace; background: #f9f9f9; margin: 0; padding: 24px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; }
        th { background: #1976d2; color: #fff; }
        tr:hover td { background: #e3f2fd; }
        .decoded { margin-top: 24px; background: #fff; padding: 12px; border-radius: 4px; }
      </style>
    </head><body>
      <h2>Hex Viewer</h2>
      <table>
        <thead><tr><th>Byte Offset</th><th>Hex Values</th><th>Decoded Text</th></tr></thead>
        <tbody>
          ${hexData.hexRows.map(row => `<tr><td>${row.offset}</td><td>${row.hex}</td><td>${row.text}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="decoded">
        <b>Decoded Text:</b><br />
        <span>${hexData.decodedText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
      </div>
    </body></html>`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError('');
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await axios.post('/api/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || (lang === 'ar' ? 'فشل التحليل.' : 'Analysis failed.'));
    }
    setLoading(false);
  };

  // PDF export logic
  const handleExportPdf = () => {
    if (!result) return;
    import('jspdf').then(jsPDFModule => {
      const jsPDF = jsPDFModule.jsPDF;
      const doc = new jsPDF();
      doc.setFont('helvetica');
      let y = 10;
      const left = 10;
      const right = 200;
      const lineHeight = 7;
      const maxY = 280;
      doc.setFontSize(16);
      doc.text(t.title, left, y);
      y += lineHeight;
      doc.setFontSize(12);
      doc.text(t.summary, left, y);
      y += lineHeight;
      doc.setFontSize(10);
      let lines = doc.splitTextToSize(t.summaryText, right - left - 2);
      lines.forEach(line => {
        if (y > maxY) { doc.addPage(); y = 10; }
        doc.text(line, left, y);
        y += lineHeight - 2;
      });
      y += 2;
      doc.setFontSize(12);
      doc.text(t.techForensics, left, y);
      y += lineHeight;
      doc.setFontSize(10);
      doc.text(t.extractedMeta, left, y);
      y += lineHeight;
      // Metadata
      Object.entries(result.metadata || {}).forEach(([key, value]) => {
        let str = typeof value === 'object' && value !== null ? (value.rawValue !== undefined ? String(value.rawValue) : JSON.stringify(value)) : String(value);
        // Remove all spaces for path-like fields to avoid split characters
        const pathLikeFields = ['SourceFile', 'Directory', 'FileName', 'FilePath'];
        if (pathLikeFields.includes(key)) {
          str = str.replace(/\s+/g, '');
        }
        try { str = decodeURIComponent(str); } catch (e) {}
        let metaLines = doc.splitTextToSize(`${key}: ${str}`, right - left - 2);
        metaLines.forEach(line => {
          if (y > maxY) { doc.addPage(); y = 10; }
          doc.text(line, left + 2, y);
          y += lineHeight - 2;
        });
      });
      y += 2;
      doc.setFontSize(12);
      doc.text(t.imageProps, left, y);
      y += lineHeight;
      doc.setFontSize(10);
      Object.entries(result.imageInfo || {}).forEach(([key, value]) => {
        let str = typeof value === 'object' && value !== null ? (value.rawValue !== undefined ? String(value.rawValue) : JSON.stringify(value)) : String(value);
        const pathLikeFields = ['SourceFile', 'Directory', 'FileName', 'FilePath'];
        if (pathLikeFields.includes(key)) {
          str = str.replace(/\s+/g, '');
        }
        try { str = decodeURIComponent(str); } catch (e) {}
        let infoLines = doc.splitTextToSize(`${key}: ${str}`, right - left - 2);
        infoLines.forEach(line => {
          if (y > maxY) { doc.addPage(); y = 10; }
          doc.text(line, left + 2, y);
          y += lineHeight - 2;
        });
      });
      y += 2;
      doc.setFontSize(12);
      doc.text(t.detectedText, left, y);
      y += lineHeight;
      doc.setFontSize(10);
      let ocrLines = doc.splitTextToSize(result.ocr?.trim() || t.noText, right - left - 2);
      ocrLines.forEach(line => {
        if (y > maxY) { doc.addPage(); y = 10; }
        doc.text(line, left + 2, y);
        y += lineHeight - 2;
      });
      y += 2;
      doc.setFontSize(12);
      doc.text(t.obs, left, y);
      y += lineHeight;
      doc.setFontSize(10);
      t.obsList.forEach(obs => {
        let obsLines = doc.splitTextToSize(`- ${obs}`, right - left - 2);
        obsLines.forEach(line => {
          if (y > maxY) { doc.addPage(); y = 10; }
          doc.text(line, left + 2, y);
          y += lineHeight - 2;
        });
      });
      y += 2;
      doc.setFontSize(12);
      doc.text(t.confidence, left, y);
      y += lineHeight;
      doc.setFontSize(10);
      const confLines = [
        `${t.metaConf}: ${t.high}`,
        `${t.imgConf}: ${t.high}`,
        `${t.ocrConf}: ${t.medium}`
      ];
      confLines.forEach(line => {
        if (y > maxY) { doc.addPage(); y = 10; }
        doc.text(line, left + 2, y);
        y += lineHeight - 2;
      });
      doc.save('forensic_report.pdf');
    });
  };

  // XLSX export logic
  const handleExportXlsx = () => {
    if (!result) return;
    import('xlsx').then(XLSX => {
      const MAX_CELL_LENGTH = 32767;
      const safeValue = v => {
        let str = typeof v === 'object' && v !== null ? (v.rawValue !== undefined ? String(v.rawValue) : JSON.stringify(v)) : String(v);
        return str.length > MAX_CELL_LENGTH ? str.slice(0, MAX_CELL_LENGTH - 3) + '...' : str;
      };
      const wb = XLSX.utils.book_new();
      // Metadata sheet
      const metaSheet = XLSX.utils.json_to_sheet(
        Object.entries(result.metadata || {}).map(([k, v]) => ({ Key: k, Value: safeValue(v) }))
      );
      XLSX.utils.book_append_sheet(wb, metaSheet, 'Metadata');
      // Image Info sheet
      const infoSheet = XLSX.utils.json_to_sheet(
        Object.entries(result.imageInfo || {}).map(([k, v]) => ({ Key: k, Value: safeValue(v) }))
      );
      XLSX.utils.book_append_sheet(wb, infoSheet, 'ImageInfo');
      // OCR sheet
      const ocrText = result.ocr?.trim() || t.noText;
      const ocrSheet = XLSX.utils.aoa_to_sheet([[t.detectedText], [safeValue(ocrText)]]);
      XLSX.utils.book_append_sheet(wb, ocrSheet, 'OCR');
      XLSX.writeFile(wb, 'forensic_report.xlsx');
    });
  };

  // زر إزالة البيانات الوصفية
  const handleRemoveMetadata = async (targetFile = null) => {
    const imgFile = targetFile || file;
    if (!imgFile) return;
    setLoading(true);
    setError('');
    setDownloadUrl('');
    const formData = new FormData();
    formData.append('image', imgFile);
    try {
      const res = await axios.post('/api/remove-metadata', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success && res.data.output) {
        setError(lang === 'ar' ? `تمت إزالة البيانات الوصفية وحفظ الصورة باسم: ${res.data.output}` : `Metadata removed. Saved as: ${res.data.output}`);
        setDownloadUrl(`/uploads/${res.data.output}`);
      } else {
        setError((res.data && res.data.error) ? (lang === 'ar' ? `فشل إزالة البيانات الوصفية: ${res.data.error}` : `Failed to remove metadata: ${res.data.error}`) : (lang === 'ar' ? 'فشل إزالة البيانات الوصفية.' : 'Failed to remove metadata.'));
      }
    } catch (err) {
      setError(err.response?.data?.error ? (lang === 'ar' ? `فشل إزالة البيانات الوصفية: ${err.response.data.error}` : `Failed to remove metadata: ${err.response.data.error}`) : (lang === 'ar' ? 'فشل إزالة البيانات الوصفية.' : 'Failed to remove metadata.'));
    }
    setLoading(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ mt: 4, direction: theme.direction }}>
        <Box display="flex" justifyContent={lang === 'ar' ? 'flex-start' : 'flex-end'} mb={2}>
          <Button variant="outlined" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t.langSwitch}</Button>
        </Box>
        <Typography variant="h4" gutterBottom align={lang === 'ar' ? 'right' : 'left'}>{t.title}</Typography>
        <Paper sx={{ p: 3, mb: 3 }}>
          <form onSubmit={handleSubmit}>
            <Box display="flex" alignItems="center" gap={2} flexDirection={lang === 'ar' ? 'row-reverse' : 'row'}>
              <Button variant="contained" component="label">
                {t.selectImage}
                <input type="file" accept="image/*" hidden onChange={handleFileChange} />
              </Button>
              <TextField value={file?.name || ''} label={t.selectedFile} InputProps={{ readOnly: true }} sx={{ flex: 1 }} />
              <Button type="submit" variant="contained" disabled={!file || loading}>{t.analyze}</Button>
              <Button variant="outlined" disabled={!file} onClick={() => handleRemoveMetadata()} sx={{ ml: 2 }}>{lang === 'ar' ? 'إزالة البيانات الوصفية' : 'Remove Metadata'}</Button>
              <Button variant="outlined" disabled={!file} onClick={async () => {
                const hex = await extractHexData(file);
                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(renderHexHtml(hex));
                  win.document.close();
                }
              }} sx={{ ml: 2 }}>{lang === 'ar' ? 'عرض القيم الست عشرية' : 'View Hex'}</Button>
            </Box>
            {downloadUrl && (
              <Box sx={{ mt: 2 }}>
                <a href={downloadUrl} download style={{ color: '#1976d2', fontWeight: 'bold', fontSize: '1.1em' }}>
                  {lang === 'ar' ? 'تحميل الصورة الخالية من البيانات الوصفية' : 'Download metadata-free image'}
                </a>
              </Box>
            )}
          </form>
          {loading && <LinearProgress sx={{ mt: 2 }} />}
          {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
        </Paper>
        <HexViewer open={hexOpen} onClose={() => setHexOpen(false)} hexData={hexData} />
        {result && (
          <Box>
            <Card sx={{ mb: 3, background: '#f5f5f5' }}>
              <CardContent>
                <Box display="flex" justifyContent={lang === 'ar' ? 'flex-start' : 'flex-end'} alignItems="center" mb={1}>
                  <Typography variant="h5" gutterBottom align={lang === 'ar' ? 'right' : 'left'} sx={{ flex: 1 }}>{t.report}</Typography>
                  {React.createElement(require('./ExportIcons').default, { onPdf: handleExportPdf, onXlsx: handleExportXlsx })}
                </Box>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" fontWeight="bold" align={lang === 'ar' ? 'right' : 'left'}>{t.summary}</Typography>
                <Typography variant="body1" align={lang === 'ar' ? 'right' : 'left'}>{t.summaryText}</Typography>
              </CardContent>
            </Card>
            {downloadUrl && (
              <Box sx={{ mb: 2 }}>
                <a href={downloadUrl} download style={{ color: '#1976d2', fontWeight: 'bold', fontSize: '1.1em' }}>
                  {lang === 'ar' ? 'تحميل الصورة الخالية من البيانات الوصفية' : 'Download metadata-free image'}
                </a>
              </Box>
            )}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" align={lang === 'ar' ? 'right' : 'left'}>{t.techForensics}</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ mb: 1 }} align={lang === 'ar' ? 'right' : 'left'}>{t.extractedMeta}</Typography>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, direction: theme.direction, background: '#fff' }}>
                <tbody>
                  {Object.entries(result.metadata || {}).map(([key, value]) => (
                    <MetadataCell key={key} k={key} value={value} />
                  ))}
                </tbody>
              </table>
              <Typography variant="caption">{t.high} (direct extraction)</Typography>
            </Paper>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="body2" fontWeight="bold" align={lang === 'ar' ? 'right' : 'left'}>{t.imageProps}</Typography>
              <Divider sx={{ my: 1 }} />
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, direction: theme.direction, background: '#fff' }}>
                <tbody>
                  {Object.entries(result.imageInfo || {}).map(([key, value]) => (
                    <MetadataCell key={key} k={key} value={value} />
                  ))}
                </tbody>
              </table>
              <Typography variant="caption">{t.high} (direct extraction)</Typography>
            </Paper>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" align={lang === 'ar' ? 'right' : 'left'}>{t.visualAnalysis}</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ mb: 1 }} align={lang === 'ar' ? 'right' : 'left'}>{t.detectedText}</Typography>
              <Paper variant="outlined" sx={{ p: 1, background: '#f9f9f9' }}>
                <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }} align={lang === 'ar' ? 'right' : 'left'}>{result.ocr?.trim() || t.noText}</Typography>
              </Paper>
              <Typography variant="caption">{t.medium} (OCR accuracy may vary)</Typography>
            </Paper>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" align={lang === 'ar' ? 'right' : 'left'}>{t.obs}</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" align={lang === 'ar' ? 'right' : 'left'}>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {/* Dynamic observations based on analysis */}
                  {/* Metadata checks */}
                  {(!result.metadata || Object.keys(result.metadata).length === 0) && (
                    <li>{lang === 'ar' ? 'لا توجد بيانات وصفية متاحة في الصورة.' : 'No metadata available in the image.'}</li>
                  )}
                  {result.metadata && result.metadata.Make && (
                    <li>{lang === 'ar' ? `تم التقاط الصورة بجهاز: ${result.metadata.Make}` : `Image captured with device: ${result.metadata.Make}`}</li>
                  )}
                  {result.metadata && result.metadata.Software && (
                    <li>{lang === 'ar' ? `تمت معالجة الصورة بواسطة برنامج: ${result.metadata.Software}` : `Image processed by software: ${result.metadata.Software}`}</li>
                  )}
                  {result.metadata && result.metadata.GPSLatitude && result.metadata.GPSLongitude && (
                    <li>{lang === 'ar' ? `الصورة تحتوي على بيانات الموقع الجغرافي.` : 'Image contains GPS geolocation data.'}</li>
                  )}
                  {/* Image info checks */}
                  {result.imageInfo && result.imageInfo.width && result.imageInfo.height && (
                    <li>{lang === 'ar' ? `أبعاد الصورة: ${result.imageInfo.width} × ${result.imageInfo.height}` : `Image dimensions: ${result.imageInfo.width} × ${result.imageInfo.height}`}</li>
                  )}
                  {result.imageInfo && result.imageInfo.format && (
                    <li>{lang === 'ar' ? `تنسيق الصورة: ${result.imageInfo.format}` : `Image format: ${result.imageInfo.format}`}</li>
                  )}
                  {/* OCR checks */}
                  {result.ocr && result.ocr.trim() && (
                    <li>{lang === 'ar' ? 'تم اكتشاف نص في الصورة.' : 'Text detected in the image.'}</li>
                  )}
                  {(!result.ocr || !result.ocr.trim()) && (
                    <li>{lang === 'ar' ? 'لم يتم اكتشاف نص في الصورة.' : 'No text detected in the image.'}</li>
                  )}
                  {/* Default/fallback observations */}
                  <li>{lang === 'ar' ? 'تمت معالجة جميع البيانات بناءً على التحليل المباشر للملف.' : 'All data processed based on direct file analysis.'}</li>
                </ul>
              </Typography>
            </Paper>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" align={lang === 'ar' ? 'right' : 'left'}>{t.confidence}</Typography>
              <Divider sx={{ my: 1 }} />
              <table style={{ width: '100%', borderCollapse: 'collapse', direction: theme.direction, background: '#fff' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ccc', padding: 4 }}>{t.section}</th>
                    <th style={{ border: '1px solid #ccc', padding: 4 }}>{t.conf}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: 4 }}>{t.metaConf}</td>
                    <td style={{ border: '1px solid #ccc', padding: 4 }}>{t.high}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: 4 }}>{t.imgConf}</td>
                    <td style={{ border: '1px solid #ccc', padding: 4 }}>{t.high}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: 4 }}>{t.ocrConf}</td>
                    <td style={{ border: '1px solid #ccc', padding: 4 }}>{t.medium}</td>
                  </tr>
                </tbody>
              </table>
            </Paper>
          </Box>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
