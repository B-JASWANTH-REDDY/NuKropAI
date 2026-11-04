function deleteKhataEntry(id) {
  const index = farmKhataEntries.findIndex(e => e.id === id);
  if (index === -1) return;
  const deletedItem = farmKhataEntries[index];

  // Optimistically remove from state
  farmKhataEntries = farmKhataEntries.filter(e => e.id !== id);
  if (typeof openScreen === 'function') openScreen('khata', document.getElementById('tab-khata'));

  // Show luxury undo toast with reversible action
  if (typeof showLuxuryToastWithUndo === 'function') {
    showLuxuryToastWithUndo(
      TL('Transaction removed from Khata', 'ఖాతా నుండి లావాదేవీ తొలగించబడింది', 'खाता से लेन-देन हटाया गया'),
      function() {
        farmKhataEntries.splice(index, 0, deletedItem);
        if (typeof openScreen === 'function') openScreen('khata', document.getElementById('tab-khata'));
        if (typeof showLuxuryToast === 'function') {
          showLuxuryToast(TL('Transaction restored to Khata', 'లావాదేవీ తిరిగి చేర్చబడింది', 'लेन-देन पुनर्स्थापित किया गया'), 'success');
        }
      },
      'warning',
      6000
    );
  }
}