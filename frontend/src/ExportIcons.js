import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';

function ExportIcons({ onPdf, onXlsx }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Tooltip title="Export PDF">
        <IconButton onClick={onPdf} size="small" color="primary">
          <PictureAsPdfIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Export XLSX">
        <IconButton onClick={onXlsx} size="small" color="primary">
          <TableChartIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </div>
  );
}

export default ExportIcons;
