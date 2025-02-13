import React from 'react';

interface CountTableProps {
  content: string;
}

export const CountTable: React.FC<CountTableProps> = ({ content }) => {
  // For simple count tables (Base, values, Total format)
  if (!content.includes('\t') || !content.includes('Base')) return null;

  const lines = content.split('\n').filter(line => line.trim());
  
  return (
    <table className="min-w-[200px] border-collapse text-sm">
      <thead>
        
      </thead>
      <tbody>
        {lines.map((line, index) => {
          const [category, count] = line.split('\t').map(s => s.trim());
          if (!category || !count) return null;
          const isHeader = category === 'Base' || category === 'Total';
          
          return (
            <tr key={index} className={isHeader ? 'font-bold bg-gray-50' : ''}>
              <td className="border border-gray-300 px-2 py-1">{category}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

interface GridTableProps {
  content: string;
}

export const GridTable: React.FC<GridTableProps> = ({ content }) => {
  // For grid summary tables
  if (!content.includes('\t')) return null;

  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split('\t').map(h => h.trim()).filter(Boolean);
  const dataRows = lines.slice(1); // Skip the header row

  // Find the Base row
  const baseRowIndex = dataRows.findIndex(row => row.split('\t')[0] === 'Base');
  const baseRow = baseRowIndex !== -1 ? dataRows[baseRowIndex] : null;
  
  // Remove Base row from dataRows to prevent duplicate rendering
  if (baseRowIndex !== -1) {
    dataRows.splice(baseRowIndex, 1);
  }

  return (
    <div className="overflow-x-auto max-w-full">
      <table className="border-collapse w-full bg-white text-sm">
        <thead>
          <tr>
            <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-left font-medium"></th>
            {headers.map((header, index) => (
              <th 
                key={index} 
                className="border border-gray-300 px-2 py-1 bg-gray-100 text-center font-medium"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Render Base row first if it exists */}
          {baseRow && (
            <tr className="bg-gray-50 font-bold">
              {baseRow.split('\t').map((cell, cellIndex) => (
                <td 
                  key={`base-${cellIndex}`}
                  className="border border-gray-300 px-2 py-1 text-center"
                >
                  {cell}
                </td>
              ))}
            </tr>
          )}
          {/* Render all other rows */}
          {dataRows.map((row, rowIndex) => {
            const cells = row.split('\t').map(cell => cell.trim());
            const isTotalRow = cells[0] === 'Total';
            
            return (
              <tr key={rowIndex} className={isTotalRow ? 'font-bold' : ''}>
                {cells.map((cell, cellIndex) => (
                  <td 
                    key={cellIndex} 
                    className="border border-gray-300 px-2 py-1 text-center"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export function formatTableContent(content: string): string | React.ReactElement {
  // Check if it's a grid summary table
  if ((content.toLowerCase().includes('summary') || content.toLowerCase().includes('grid')) && content.includes('\t')) {
    return <GridTable content={content} />;
  }
  
  // Check if it's a simple count table
  if (content.includes('Base') && content.includes('Total')) {
    return <CountTable content={content} />;
  }
  
  // Return original content if no table format matches
  return content;
} 