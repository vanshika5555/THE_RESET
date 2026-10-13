import React from 'react';
import axios from 'axios';
import ProductForm, { BLANK_PRODUCT } from './ProductForm';

export default function AddProduct() {
  return (
    <ProductForm
      initial={BLANK_PRODUCT}
      saveLabel="Add product"
      onSave={(payload) => axios.post('/api/products', payload)}
    />
  );
}
