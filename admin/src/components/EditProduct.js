import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import ProductForm from './ProductForm';
import { Empty } from './ui';

export default function EditProduct() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    axios.get(`/api/products/${id}`)
      .then((res) => setProduct(res.data))
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return (
      <div className="panel">
        <Empty
          title="This product doesn’t exist any more"
          text="It may have been deleted. Go back to the product list to pick another."
          action={<Link to="/products" className="btn btn--primary">Back to products</Link>}
        />
      </div>
    );
  }

  if (!product) return <div className="loading">Loading product…</div>;

  return (
    <ProductForm
      key={product._id}
      initial={product}
      saveLabel="Save changes"
      onSave={(payload) => axios.put(`/api/products/${id}`, payload)}
    />
  );
}
