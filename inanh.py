from PIL import Image, ImageDraw, ImageFont
import os
import sys
from pathlib import Path
import numpy as np

def remove_black_bars(img, threshold=30):
   
    # Convert image to numpy array
    img_array = np.array(img)
    
    # Calculate average brightness for each row
    if len(img_array.shape) == 3:  # Color image    
        row_brightness = np.mean(img_array, axis=(1, 2))
    else:  # Grayscale image
        row_brightness = np.mean(img_array, axis=1)
    
    # Find first non-black row from top
    top = 0
    for i, brightness in enumerate(row_brightness):
        if brightness > threshold:
            top = i
            break
    
    # Find first non-black row from bottom
    bottom = len(row_brightness) - 1
    for i in range(len(row_brightness) - 1, -1, -1):
        if row_brightness[i] > threshold:
            bottom = i
            break
    
    # Crop the image
    if bottom > top:
        img_cropped = img.crop((0, top, img.width, bottom + 1))
        return img_cropped, (top, bottom)
    
    return img, (0, img.height - 1)

def create_image_collage(input_folder, output_file="output_collage.jpg", cols=5, rows=2, 
                         border_width=1, border_color=(0, 0, 0), 
                         img_width=250, img_height=350, cell_padding=15, outer_margin=30,
                         remove_bars=True):
    """
    Create a collage from images in a folder
    
    Args:
        input_folder: Path to folder containing images
        output_file: Output filename
        cols: Number of columns in grid
        rows: Number of rows in grid
        border_width: Width of black border/grid lines between cells
        border_color: RGB color of border (black by default)
        img_width: Width of each cell in collage
        img_height: Height of each cell in collage
        cell_padding: Padding inside each cell around the image (white space)
        outer_margin: Margin around the entire grid (space from matrix to canvas edges)
        remove_bars: Whether to detect and remove black bars from images
    """
    
    # Get all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'}
    image_files = []
    
    if not os.path.exists(input_folder):
        print(f"Error: Folder '{input_folder}' not found!")
        return
    
    for file in os.listdir(input_folder):
        if Path(file).suffix.lower() in image_extensions:
            image_files.append(os.path.join(input_folder, file))
    
    if not image_files:
        print(f"No images found in '{input_folder}'!")
        return
    
    # Sort files
    image_files.sort()
    
    # Calculate grid size (without outer margin)
    grid_width = cols * img_width + (cols + 1) * border_width
    grid_height = rows * img_height + (rows + 1) * border_width
    
    # Calculate canvas size (with outer margin)
    canvas_width = grid_width + (2 * outer_margin)
    canvas_height = grid_height + (2 * outer_margin)
    
    # Create canvas with white background
    canvas = Image.new('RGB', (canvas_width, canvas_height), (255, 255, 255))
    
    # Create the grid on a separate image with black background
    grid = Image.new('RGB', (grid_width, grid_height), border_color)
    
    print(f"Found {len(image_files)} images")
    print(f"Creating collage: {cols}x{rows} grid")
    print(f"Canvas size: {canvas_width}x{canvas_height}")
    print(f"Grid size: {grid_width}x{grid_height}")
    print(f"Outer margin: {outer_margin}px, Black border width: {border_width}px, Cell padding: {cell_padding}px")
    if remove_bars:
        print("Black bar removal: ENABLED")
    
    # Place images
    placed = 0
    for idx, img_path in enumerate(image_files):
        if placed >= cols * rows:
            break
        
        try:
            row = placed // cols
            col = placed % cols
            
            # Calculate position (relative to grid, not canvas)
            x = border_width + col * (img_width + border_width)
            y = border_width + row * (img_height + border_width)
            
            # Open image
            img = Image.open(img_path)
            original_width, original_height = img.size
            
            # Remove black bars if enabled
            if remove_bars:
                img_cropped, (top_crop, bottom_crop) = remove_black_bars(img)
                if top_crop > 0 or bottom_crop < original_height - 1:
                    cropped_amount = top_crop + (original_height - bottom_crop - 1)
                    print(f"  → Removed {cropped_amount}px of black bars from {os.path.basename(img_path)}")
                    img = img_cropped
            
            # Detect orientation
            is_portrait = img.height > img.width
            is_landscape = img.width > img.height
            is_square = img.width == img.height
            
            # Determine orientation type
            if is_portrait:
                orientation = "Portrait"
            elif is_landscape:
                orientation = "Landscape"
                # Rotate landscape images 90 degrees clockwise
                img = img.rotate(-90, expand=True)
                print(f"  → Rotating landscape image 90° clockwise")
            else:
                orientation = "Square"
            
            # Calculate available space for image (cell size minus padding)
            available_width = img_width - (2 * cell_padding)
            available_height = img_height - (2 * cell_padding)
            
            # Resize image while maintaining aspect ratio to fit in available space
            img.thumbnail((available_width, available_height), Image.LANCZOS)
            
            # Create a white cell (padding background)
            cell = Image.new('RGB', (img_width, img_height), (255, 255, 255))
            
            # Center the image in the cell with padding
            paste_x = (img_width - img.width) // 2
            paste_y = (img_height - img.height) // 2
            cell.paste(img, (paste_x, paste_y))
            
            # Paste cell onto grid
            grid.paste(cell, (x, y))
            placed += 1
            print(f"Placed image {placed}/{cols * rows}: {os.path.basename(img_path)} [{orientation} {original_width}x{original_height}]")
            
        except Exception as e:
            print(f"Error processing {img_path}: {e}")
    
    # Paste the grid onto the canvas with outer margin
    canvas.paste(grid, (outer_margin, outer_margin))
    
    # Convert to RGB mode if not already (ensures proper color handling)
    if canvas.mode != 'RGB':
        canvas = canvas.convert('RGB')
    
    # Save result with proper settings for printing
    canvas.save(output_file, 
                quality=95, 
                format='JPEG',
                subsampling=0,  # Best quality color subsampling
                optimize=True)  # Optimize file size without losing quality
    print(f"\nCollage saved to: {output_file}")
    print(f"Total images placed: {placed}")

def main():
    print("=" * 60)
    print("Image Collage Creator")
    print("=" * 60)
    
    # Define the images folder path
    images_folder = "your_images"
    output_folder = "output_images"
    
    # Check if images folder exists
    if not os.path.exists(images_folder):
        # First run - create the folder
        os.makedirs(images_folder)
        print(f"\n✓ Created '{images_folder}' folder!")
        print(f"\nFIRST TIME SETUP:")
        print(f"1. Create subfolders inside the '{images_folder}' folder")
        print(f"2. Place your images in each subfolder")
        print(f"3. Run this program again to create collages")
        print(f"\nSupported formats: JPG, JPEG, PNG, BMP, GIF, WEBP")
        print("=" * 60)
        return
    
    # Create output folder if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        print(f"✓ Created '{output_folder}' folder for output files\n")
    
    # Find all subfolders in images folder
    subfolders = []
    for item in os.listdir(images_folder):
        item_path = os.path.join(images_folder, item)
        if os.path.isdir(item_path):
            subfolders.append(item)
    
    if not subfolders:
        print(f"No subfolders found in '{images_folder}'!")
        print("Please create subfolders and add images to them.")
        return
    
    print(f"Found {len(subfolders)} subfolder(s) to process:\n")
    
    # Process each subfolder
    for idx, subfolder_name in enumerate(sorted(subfolders), 1):
        print(f"\n{'=' * 60}")
        print(f"Processing folder {idx}/{len(subfolders)}: {subfolder_name}")
        print(f"{'=' * 60}")
        
        subfolder_path = os.path.join(images_folder, subfolder_name)
        
        # Count images in subfolder
        image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'}
        image_count = 0
        for file in os.listdir(subfolder_path):
            if Path(file).suffix.lower() in image_extensions:
                image_count += 1
        
        if image_count == 0:
            print(f"⚠ No images found in '{subfolder_name}' - skipping")
            continue
        
        # Calculate grid dimensions (prefer 5 columns, calculate rows needed)
        cols = 5
        rows = (image_count + cols - 1) // cols  # Round up division
        
        print(f"Found {image_count} images")
        print(f"Grid layout: {cols} columns × {rows} rows = {cols * rows} cells")
        
        # Create output filename based on subfolder name
        output_file = os.path.join(output_folder, f"{subfolder_name}.jpg")
        
        # Create the collage
        create_image_collage(
            input_folder=subfolder_path,
            output_file=output_file,
            cols=cols,
            rows=rows,
            border_width=1,  # Thicker border for very high resolution
            border_color=(0, 0, 0),
            img_width=750,  # Tripled from 250 for professional print quality
            img_height=1050,  # Tripled from 350 for professional print quality
            cell_padding=30,  # Increased padding for higher resolution
            outer_margin=90,  # Increased margin for higher resolution
            remove_bars=True  # Enable black bar removal
        )
        
        print(f"✓ Saved: {output_file}")
    
    print("\n" + "=" * 60)
    print(f"✓ All done! Generated {len(subfolders)} collage(s) in '{output_folder}/' folder")
    print("=" * 60)

if __name__ == "__main__":
    main()