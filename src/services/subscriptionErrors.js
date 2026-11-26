export function subscriptionErrors(label, onError) {
  return (error) => {
    if (onError) onError(error);
    else if (error.code !== 'permission-denied') console.warn('Abonnement Firestore indisponible', label, error.code);
  };
}
