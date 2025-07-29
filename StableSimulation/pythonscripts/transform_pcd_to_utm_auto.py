import os
import argparse
import numpy as np
from pathlib import Path
from tqdm import tqdm
import struct

def compute_3d_transform(A, B):
    assert A.shape == B.shape
    centroid_A = np.mean(A, axis=0)
    centroid_B = np.mean(B, axis=0)
    AA = A - centroid_A
    BB = B - centroid_B
    H = AA.T @ BB
    U, S, Vt = np.linalg.svd(H)
    R = Vt.T @ U.T
    if np.linalg.det(R) < 0:
        Vt[2,:] *= -1
        R = Vt.T @ U.T
    t = centroid_B - R @ centroid_A
    return R, t

def read_pcd_header(filepath):
    header_lines = []
    with open(filepath, 'rb') as f:
        while True:
            line = f.readline()
            if not line:
                break
            header_lines.append(line)
            if line.strip().startswith(b'DATA'):
                break
    header = b''.join(header_lines)
    return header, header_lines

def parse_pcd_header(header_lines):
    meta = {}
    for line in header_lines:
        line = line.decode('ascii').strip()
        if line.startswith('FIELDS'):
            meta['fields'] = line.split()[1:]
        elif line.startswith('SIZE'):
            meta['sizes'] = [int(x) for x in line.split()[1:]]
        elif line.startswith('TYPE') or line.startswith('TYPES'):
            meta['types'] = line.split()[1:]
        elif line.startswith('COUNT'):
            meta['counts'] = [int(x) for x in line.split()[1:]]
        elif line.startswith('WIDTH'):
            meta['width'] = int(line.split()[1])
        elif line.startswith('HEIGHT'):
            meta['height'] = int(line.split()[1])
        elif line.startswith('POINTS'):
            meta['points'] = int(line.split()[1])
        elif line.startswith('DATA'):
            meta['data'] = line.split()[1]
    return meta

def read_pcd_data(filepath, header, meta):
    # Only binary supported
    if meta['data'] != 'binary':
        raise ValueError('Only binary PCD files are supported!')
    with open(filepath, 'rb') as f:
        f.seek(len(header))
        point_size = sum(meta['sizes'])
        num_points = meta['points']
        data = f.read(point_size * num_points)
        # Build numpy dtype
        dtype_list = []
        for field, size, typ, count in zip(meta['fields'], meta['sizes'], meta['types'], meta['counts']):
            np_type = {('F',4): 'f4', ('F',8): 'f8', ('U',1): 'u1', ('U',2): 'u2', ('U',4): 'u4', ('I',1): 'i1', ('I',2): 'i2', ('I',4): 'i4'}[(typ, size)]
            if count == 1:
                dtype_list.append((field, np_type))
            else:
                dtype_list.append((field, np_type, (count,)))
        dtype = np.dtype(dtype_list)
        points = np.frombuffer(data, dtype=dtype, count=num_points).copy()
    return points

def write_pcd(filepath, header, points):
    with open(filepath, 'wb') as f:
        f.write(header)
        f.write(points.tobytes())

def main():
    parser = argparse.ArgumentParser(description="Transform all PCD files in directory tree to UTM coordinates using 4 pairs of 3D points. Only binary PCD supported.")
    parser.add_argument('--input_dir', type=str, required=True, help='Input root directory with PCD files (recursively)')
    parser.add_argument('--output_dir', type=str, required=True, help='Output root directory for transformed PCD files')
    args = parser.parse_args()

    # --- RUCNI UNOS TACAKA ---
    # Lokalni sistem (xyz)
    local_pts = np.array([
        [-137.855835, 129.495712, -26.114115],
        [49.219326, 33.309235, -25.104013],
        [-43.706833, -180.315460, -25.098383],
        [-218.436676, -107.509506, -24.291012]
    ])
    # Globalni sistem (XYZ)
    global_pts = np.array([
        [690902.18, 5336214.06, 0],
        [691089.499, 5336124.518, 0],
        [691003.548, 5335906.522, 0],
        [690826.618, 5335973.974, 0]
    ])

    R, t = compute_3d_transform(local_pts, global_pts)

    input_path = Path(args.input_dir)
    output_path = Path(args.output_dir)
    pcd_files = list(input_path.rglob("*.pcd"))
    total_files = len(pcd_files)
    success_count = 0
    with tqdm(total=total_files, desc="Transforming PCD files", unit="file", ncols=80, bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{percentage:3.0f}%]') as pbar:
        for pcd_file in pcd_files:
            rel_path = pcd_file.relative_to(input_path)
            output_file = output_path / rel_path
            try:
                header, header_lines = read_pcd_header(str(pcd_file))
                meta = parse_pcd_header(header_lines)
                points = read_pcd_data(str(pcd_file), header, meta)
                # Transform only x, y, z
                if all(f in points.dtype.names for f in ('x','y','z')):
                    xyz = np.stack([points['x'], points['y'], points['z']], axis=1)
                    xyz_trans = (R @ xyz.T).T + t
                    points['x'] = xyz_trans[:,0]
                    points['y'] = xyz_trans[:,1]
                    points['z'] = xyz_trans[:,2]
                else:
                    print(f"[ERROR] File {pcd_file} does not have x, y, z fields. Skipping.")
                    pbar.update(1)
                    continue
                os.makedirs(os.path.dirname(output_file), exist_ok=True)
                write_pcd(str(output_file), header, points)
                success_count += 1
            except Exception as e:
                print(f"[ERROR] {pcd_file}: {e}")
            pbar.update(1)
    print(f"Successfully transformed {success_count}/{total_files} files.")
    print("\n--- TRANSFORMATION INFO ---")
    print("Type: Kabsch 3D rigid (no scaling)")
    print("Rotation matrix (R):\n", R)
    # Euler angles from rotation matrix (XYZ order)
    from scipy.spatial.transform import Rotation as Rscipy
    euler_rad = Rscipy.from_matrix(R).as_euler('xyz')
    euler_deg = np.degrees(euler_rad)
    print(f"Euler angles (XYZ order): {euler_rad} radians, {euler_deg} degrees")
    print("Translation vector (t):", t)
    print("Points used for transformation:")
    for i, (loc, glob) in enumerate(zip(local_pts, global_pts), 1):
        print(f"  Local {i}: {loc}")
        print(f"  Global {i}: {glob}")

if __name__ == "__main__":
    main() 