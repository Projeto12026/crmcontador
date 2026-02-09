/**
 * Generate a .docx file from the contract text
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

export async function downloadContractAsDocx(contractText: string, filename: string = 'Contrato-EI-SLU.docx') {
  const lines = contractText.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Separator line
    if (trimmed.startsWith('──')) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 200, after: 200 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          },
        })
      );
      continue;
    }

    // Title line (all caps, first line or CONSOLIDAÇÃO)
    const isTitle = trimmed === trimmed.toUpperCase() && trimmed.length > 10 && !trimmed.startsWith('CNPJ') && !trimmed.startsWith('NIRE') && !trimmed.startsWith('_');

    // Clause headers
    const isClause = /^Cláusula \d+ª/.test(trimmed);

    // Signature line
    const isSignatureLine = trimmed.startsWith('___');

    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { before: 0, after: 0 } }));
      continue;
    }

    if (isTitle) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 26, // 13pt
              font: 'Times New Roman',
            }),
          ],
        })
      );
    } else if (isClause) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 24, // 12pt
              font: 'Times New Roman',
            }),
          ],
        })
      );
    } else if (isSignatureLine) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 40 },
          children: [
            new TextRun({
              text: trimmed,
              size: 24,
              font: 'Times New Roman',
            }),
          ],
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({
              text: trimmed,
              size: 24, // 12pt
              font: 'Times New Roman',
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
