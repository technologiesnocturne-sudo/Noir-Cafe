# Products Display
1. Schema for Product to match with server.
2. Notes:  Make sure it matches to the schema and server

```python
product ={
"name":"productName",
"description":"productDesc",
"image_url": "",
"stock":"",
"created_at":"",
}

```
## Product Illustration
Display four product on grid

```html
<div class="card">
    <div class="card-img">
        <img src="#" alt="Product Image">
    </div>
    <p class="name">Dark Latte</p>
    <button onclick="addToCart()"><!--Cart-Icon--></button>
    <span class="price" data-price=""></span>
    <p class="description"></p>
</div>
```

## Styling
```css
.name{
    font-family:'Fraunces', 'Georgia', serif;
    font-size:0.5rem;
    text-align:left;
}

```

### Menu Display
```text
Inspo: Apple Airplay 
More details about how it will look ("inspo.drawio")

```

```text
The Menu
                --------------
                Menu Display
                --------------
