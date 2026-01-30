import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, Table, TableBody, TableCell, TableRow, Box } from '@mui/material';

function HexViewer({ open, onClose, hexData }) {
  const [selected, setSelected] = useState({ row: null, col: null });
  if (!hexData) return null;

  // Helper to get cell style
  const getCellStyle = (rowIdx, colIdx) => {
    if (selected.row === rowIdx && (selected.col === colIdx || selected.col === null)) {
      return { background: '#1976d2', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace' };
    }
    if (selected.row === rowIdx && selected.col !== null) {
      return { background: '#90caf9', color: '#000', cursor: 'pointer', fontFamily: 'monospace' };
    }
    return { cursor: 'pointer', fontFamily: 'monospace' };
  };

  // When any cell is clicked, select the row and column
  const handleCellClick = (rowIdx, colIdx) => {
    setSelected({ row: rowIdx, col: colIdx });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Hex Viewer</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Byte Offsets, Hex Values, Decoded Text</Typography>
        <Table size="small">
          <TableBody>
            {hexData.hexRows.map((row, rowIdx) => (
              <TableRow key={rowIdx}>
                <TableCell
                  sx={getCellStyle(rowIdx, 0)}
                  onClick={() => handleCellClick(rowIdx, 0)}
                >
                  {row.offset}
                </TableCell>
                <TableCell
                  sx={getCellStyle(rowIdx, 1)}
                  onClick={() => handleCellClick(rowIdx, 1)}
                >
                  {row.hex}
                </TableCell>
                <TableCell
                  sx={getCellStyle(rowIdx, 2)}
                  onClick={() => handleCellClick(rowIdx, 2)}
                >
                  {row.text}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box mt={3}>
          <Typography variant="subtitle1">Decoded Text</Typography>
          <Typography variant="body2" sx={{ wordBreak: 'break-all', background: '#f9f9f9', p: 1 }}>{hexData.decodedText}</Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default HexViewer;
