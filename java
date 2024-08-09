document.getElementById('tipoSistema').addEventListener('change', function(e) {
    const accumuloOptions = document.getElementById('accumuloOptions');
    if (e.target.value === 'accumulo') {
        accumuloOptions.style.display = 'block';
    } else {
        accumuloOptions.style.display = 'none';
    }
});

document.getElementById('configuratore-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const tipoSistema = document.getElementById('tipoSistema').value;
    const tagliaImpianto = document.getElementById('tagliaImpianto').value;
    const tagliaAccumulo = tipoSistema === 'accumulo' ? document.getElementById('tagliaAccumulo').value : 0;
    const durataFinanziamento = document.getElementById('durataFinanziamento').value;
    const integrazione = document.getElementById('integrazione').checked ? parseFloat(document.getElementById('integrazione').value) : 0;
    const pulizia = document.getElementById('pulizia').checked ? parseFloat(document.getElementById('pulizia').value) : 0;
    const lineaVita = document.getElementById('lineaVita').checked ? parseFloat(document.getElementById('lineaVita').value) : 0;

    const costoTotale = calcolaCostoTotale(tagliaImpianto, tagliaAccumulo, tipoSistema, integrazione, pulizia, lineaVita);
    const rataMensile = calcolaRataMensile(costoTotale, durataFinanziamento);

    document.getElementById('risultato').innerText = `Rata Mensile: €${rataMensile.toFixed(2)}`;

    document.getElementById('downloadPDF').style.display = 'block';
    document.getElementById('downloadPDF').addEventListener('click', function() {
        generaPDF(tipoSistema, tagliaImpianto, tagliaAccumulo, durataFinanziamento, integrazione, pulizia, lineaVita, rataMensile);
    });
});

function calcolaCostoTotale(tagliaImpianto, tagliaAccumulo, tipoSistema, integrazione, pulizia, lineaVita) {
    let costoBase = tagliaImpianto * 1000; // Prezzo base per kW
    if (tipoSistema === 'accumulo') {
        costoBase += tagliaAccumulo * 800; // Prezzo base per kWh di accumulo
    }
    return costoBase + integrazione + pulizia + lineaVita;
}

function calcolaRataMensile(costoTotale, durataFinanziamento) {
    const tassoInteresse = 0.05; // Tasso di interesse annuale del 5%
    const numeroRate = durataFinanziamento * 12; // Durata in mesi
    const rataMensile = (costoTotale * tassoInteresse / 12) / (1 - Math.pow(1 + tassoInteresse / 12, -numeroRate));
    return rataMensile;
}

function generaPDF(tipoSistema, tagliaImpianto, tagliaAccumulo, durataFinanziamento, integrazione, pulizia, lineaVita, rataMensile) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("Riepilogo Simulazione", 10, 10);
    doc.text(`Tipo di Sistema: ${tipoSistema}`, 10, 20);
    doc.text(`Taglia Impianto: ${tagliaImpianto} kWp`, 10, 30);
    if (tipoSistema === 'accumulo') {
        doc.text(`Taglia Accumulo: ${tagliaAccumulo} kWh`, 10, 40);
    }
    doc.text(`Durata del Finanziamento: ${durataFinanziamento} anni`, 10, 50);
    doc.text(`Impianto ad Integrazione Architettonica: €${integrazione}`, 10, 60);
    doc.text(`Pulizia e Monitoraggio: €${pulizia}`, 10, 70);
    doc.text(`Linea Vita: €${lineaVita}`, 10, 80);
    doc.text(`Rata Mensile: €${rataMensile.toFixed(2)}`, 10, 90);

    doc.save("riepilogo_simulazione.pdf");
}
