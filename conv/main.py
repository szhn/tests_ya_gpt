import os
import json
#берем кнопки в тхт файлах и конвертируем в json
def convert_txt_to_json(input_folder, output_file):
    combined_data = []

    for filename in os.listdir(input_folder):
        if filename.endswith('.txt'):
            file_path = os.path.join(input_folder, filename)
            with open(file_path, 'r', encoding='utf-8') as file:
                lines = file.readlines()

                file_data = {
                    "name": os.path.splitext(filename)[0],
                    "channel": "shawdfxc",
                    "messages": [line.strip() for line in lines]
                }

                combined_data.append(file_data)

    with open(output_file, 'w', encoding='utf-8') as json_file:
        json.dump(combined_data, json_file, ensure_ascii=False, indent=4)

    print(f"Данные успешно конвертированы в {output_file}")

input_folder = os.getcwd()  
output_file = "output.json"  

convert_txt_to_json(input_folder, output_file)
