import os
import pandas as pd
import glob
import re

def extract_file_number(filename):
    """
    Izvuci broj iz imena fajla (npr. 'tumparking1.csv' -> 1)
    """
    match = re.search(r'tumparking(\d+)\.csv', filename)
    if match:
        return int(match.group(1))
    return 0

def combine_parking_csv_files():
    """
    Kombinira sve CSV fajlove iz parkingspaces direktorijuma u jedan CSV fajl
    """
    # Definiši putanje
    input_dir = r"C:\Users\Marko\Documents\Documents\TUM\SEM2 _________38\Mapping for a Sustainable World - Seminar  5\StableSimulation\main\parkingspaces"
    output_dir = r"C:\Users\Marko\Documents\Documents\TUM\SEM2 _________38\Mapping for a Sustainable World - Seminar  5\StableSimulation\main\park"
    output_file = os.path.join(output_dir, "combined_parking_spots.csv")
    
    # Kreiraj output direktorijum ako ne postoji
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Kreiran output direktorijum: {output_dir}")
    
    # Pronađi sve CSV fajlove
    csv_files = glob.glob(os.path.join(input_dir, "*.csv"))
    
    if not csv_files:
        print(f"Nema CSV fajlova u direktorijumu: {input_dir}")
        return
    
    # Sortiraj fajlove po broju
    csv_files.sort(key=lambda x: extract_file_number(os.path.basename(x)))
    
    print(f"Pronađeno {len(csv_files)} CSV fajlova")
    
    # Lista za sve tačke
    all_points = []
    
    # Procesiraj svaki CSV fajl
    for csv_file in csv_files:
        filename = os.path.basename(csv_file)
        file_number = extract_file_number(filename)
        print(f"Procesiram: {filename} (broj: {file_number})")
        
        try:
            # Učitaj CSV fajl
            df = pd.read_csv(csv_file, header=None)
            
            # Procesiraj sve tačke u fajlu
            for index, row in df.iterrows():
                x, y = row[0], row[1]
                
                # Dodaj tačku sa brojem fajla
                point = {
                    'file_number': file_number,
                    'y': y,
                    'x': x
                }
                
                all_points.append(point)
                
        except Exception as e:
            print(f"  Greška pri procesiranju {filename}: {e}")
    
    # Kreiraj DataFrame sa svim tačkama
    if all_points:
        combined_df = pd.DataFrame(all_points)
        
        # Sortiraj po broju fajla, pa po indeksu tačke
        combined_df = combined_df.sort_values(['file_number', combined_df.index])
        
        # Sačuvaj u CSV format sa samo y i x kolonama
        output_df = combined_df[['y', 'x']]
        output_df.to_csv(output_file, index=False)
        
        print(f"\nUspešno kombinovano {len(all_points)} tačaka")
        print(f"Output fajl: {output_file}")
        
        # Prikaži statistike
        print(f"\nStatistike:")
        print(f"- Ukupno tačaka: {len(all_points)}")
        print(f"- Procesirano fajlova: {len(csv_files)}")
        print(f"- Format: y, x (sortirano po broju fajla)")
        
    else:
        print("Nema validnih tačaka za kombinovanje")

if __name__ == "__main__":
    combine_parking_csv_files() 