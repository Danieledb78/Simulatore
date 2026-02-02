import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../services/api';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [product, setProduct] = useState<any>(null);
  const [manualMode, setManualMode] = useState(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setBarcode(data);
    await fetchProduct(data);
  };

  const fetchProduct = async (code: string) => {
    try {
      const response = await api.get(`/products/barcode/${code}`);
      setProduct(response.data);
    } catch {
      Alert.alert('Errore', 'Prodotto non trovato');
      setProduct(null);
    }
  };

  const handleLoadStock = async () => {
    if (!barcode || !quantity) {
      Alert.alert('Errore', 'Inserisci barcode e quantità');
      return;
    }
    try {
      await api.post('/inventory/load', {
        barcode,
        quantity: parseInt(quantity),
      });
      Alert.alert('Successo', `Caricato: ${product?.name || barcode} x${quantity}`);
      resetScanner();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.error || 'Errore nel caricamento');
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setBarcode('');
    setQuantity('1');
    setProduct(null);
  };

  if (!permission) {
    return <View style={styles.container}><Text>Caricamento...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Permesso fotocamera richiesto</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Concedi Permesso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!manualMode && !scanned ? (
        <CameraView
          style={styles.camera}
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
            <Text style={styles.scanText}>Inquadra il codice a barre</Text>
          </View>
        </CameraView>
      ) : (
        <View style={styles.resultContainer}>
          <Text style={styles.title}>Carica Merce</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Barcode</Text>
            <TextInput
              style={styles.input}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Inserisci o scansiona barcode"
              onSubmitEditing={() => fetchProduct(barcode)}
            />
          </View>

          {product && (
            <View style={styles.productCard}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productInfo}>
                Stock attuale: {product.inventory?.quantity || 0}
              </Text>
              <Text style={styles.productPrice}>€{product.sellingPrice}</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Quantità da caricare</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="Quantità"
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.button} onPress={handleLoadStock}>
              <Text style={styles.buttonText}>Carica Merce</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonSecondary} onPress={resetScanner}>
              <Text style={styles.buttonSecondaryText}>Nuova Scansione</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.modeToggle}
        onPress={() => setManualMode(!manualMode)}
      >
        <Text style={styles.modeToggleText}>
          {manualMode ? '📷 Usa Scanner' : '⌨️ Inserisci Manualmente'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  scanArea: { width: 250, height: 150, borderWidth: 2, borderColor: '#0ea5e9', borderRadius: 12 },
  scanText: { color: '#fff', marginTop: 20, fontSize: 16 },
  resultContainer: { flex: 1, backgroundColor: '#f9fafb', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 16 },
  productCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  productName: { fontSize: 18, fontWeight: '600', color: '#1e293b' },
  productInfo: { fontSize: 14, color: '#64748b', marginTop: 4 },
  productPrice: { fontSize: 16, fontWeight: '600', color: '#0ea5e9', marginTop: 8 },
  actions: { gap: 12, marginTop: 20 },
  button: { backgroundColor: '#0ea5e9', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonSecondary: { backgroundColor: '#e2e8f0', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonSecondaryText: { color: '#475569', fontSize: 16, fontWeight: '600' },
  modeToggle: { backgroundColor: '#1e293b', padding: 16, alignItems: 'center' },
  modeToggleText: { color: '#fff', fontSize: 14 },
  message: { color: '#1e293b', fontSize: 16, textAlign: 'center', marginBottom: 20 },
});
